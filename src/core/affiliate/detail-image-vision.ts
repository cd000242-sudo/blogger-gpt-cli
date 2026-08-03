/**
 * 상세정보 이미지 → 스펙 추출 + 소제목 매칭 (v3.8.431)
 *
 * ## 왜 만드나
 * 한국 쇼핑몰 상세페이지는 **글자 없는 이미지 몇 장**인 경우가 많다.
 * 크기·재질·사용법·주의사항이 전부 그 안에 그림으로 들어 있는데,
 * 지금까지는 og:title/description 몇 줄만 읽고 그 정보를 통째로 버렸다.
 * 그래서 "가격 대비 성능이 좋습니다" 같은 뻔한 문장만 나왔다.
 *
 * 사용자 요구:
 *   "상세정보가 이미지로 되어있는데 완벽히 추론해서 글이 생성되게해주시고
 *    이미지 추론이 가능하면 이 이미지들중에서 소제목에 어울리는 이미지를
 *    활용해주세요"
 *
 * ## 비용 설계 (중요)
 * 이미지 1장당 **vision 호출 1번**이다. 그 한 번에 두 가지를 같이 묻는다.
 *   ① 이 사진에서 읽어낼 수 있는 사실(스펙)
 *   ② 주어진 소제목 목록 중 어디에 어울리는지
 * "소제목마다 이미지를 다 훑는" 방식이면 이미지×소제목 만큼 곱해져 터진다.
 * 여기서는 곱하지 않는다 — O(이미지 수)이고, 그 이미지 수도 상한이 있다.
 *
 * 예산은 이 모듈이 **직접** 관리한다. url-image-crawler 의 visionBudgetGuard 는
 * 모듈 전역 누적기라 다른 기능과 예산이 뒤섞이고 글마다 초기화되지도 않는다.
 * 여기서는 "글 1편당 최대 N장"이라는 개수 상한 하나로 단순하게 묶는다.
 *
 * ## 실패해도 발행을 막지 않는다
 * 이 앱의 원칙이다. 분석이 안 되면 그냥 예전처럼 동작한다.
 */
import * as https from 'https';
import { routeTextToVision, VisionRouting } from '../url-image-crawler/visionRouter';
import { fetchImageBuffer, detectMimeType } from '../url-image-crawler/imageRelevanceScorer';

/** 글 1편당 vision 에 보낼 최대 장수 — 비용 상한의 본체 */
export const MAX_VISION_IMAGES = 12;

/** 이 점수 미만이면 "그 소제목 사진"으로 쓰지 않는다 */
export const PLACEMENT_CONFIDENCE_MIN = 60;

export interface DetailImageFacts {
  imageUrl: string;
  /** 사진에서 읽어낸 사실 (한국어 짧은 구) */
  facts: string[];
  /** 가장 어울리는 소제목 (입력한 h2Titles 중 하나) — 없으면 null */
  bestH2: string | null;
  /** 0-100 */
  confidence: number;
  /**
   * 이 사진에 **상품 실물이 찍혀 있는가** (v3.8.440).
   *
   * 사용자 요구: "추론하면서 제품이미지가없는 이미지는 제외하고
   *   제품이미지가있는이미지 위주로 수집해줘"
   *
   * 상세페이지에는 글자만 있는 안내판, 배송·교환 정책, 브랜드 스토리 배너가
   * 섞여 있다. 그런 걸 소제목 삽화로 깔면 글이 지저분해지고 구매에도 도움이
   * 안 된다. 같은 vision 호출에서 같이 물어보므로 **추가 비용은 0원**이다.
   * 판정에 실패하면(구버전 응답 등) true 로 둔다 — 못 쓰게 막는 쪽이 더 위험하다.
   *
   * 선택 필드인 이유: "아직 판정하지 않음"이 실제로 존재하는 상태다(vision 이 안
   * 돌았거나 장수 상한에 걸려 못 본 사진). 그래서 읽는 쪽은 전부 `=== false`,
   * 즉 **모델이 명시적으로 아니라고 한 경우만** 제외한다. undefined 는 통과다.
   */
  hasProduct?: boolean;
}

export interface DetailVisionOptions {
  /** 글 생성에 쓰는 모델 키 — 같은 vendor 로 vision 을 태운다 */
  textGenerator?: string | undefined;
  apiKeys: { gemini?: string | undefined; claude?: string | undefined; openai?: string | undefined };
  onLog?: ((msg: string) => void) | undefined;
  /** 테스트 주입용 — 있으면 실제 API 를 부르지 않는다 */
  askImpl?: ((prompt: string, buf: Buffer, mime: string) => Promise<string>) | undefined;
  /**
   * 테스트 주입용 이미지 로더 — 있으면 네트워크를 타지 않는다.
   * (crawl.ts 의 fetchImpl 과 같은 취지. 네트워크에 의존하는 테스트는
   *  CPU 가 붐빌 때 타임아웃으로 깨져 '진짜 회귀'와 구분이 안 된다.)
   */
  fetchImageImpl?: ((url: string) => Promise<Buffer | null>) | undefined;
  timeoutMs?: number | undefined;
}

function httpsPostJson(urlStr: string, body: any, headers: Record<string, string>, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 한 장을 보고 "사실 + 어울리는 소제목"을 한 번에 묻는다.
 * 지어내지 말라는 지시를 프롬프트에 박는다 — 이 앱 전반의 원칙이다.
 */
export function buildDetailPrompt(h2Titles: string[], productName: string): string {
  const list = h2Titles.map((t, i) => `${i}. ${t}`).join('\n');
  return [
    `당신은 쇼핑 상품의 상세페이지 이미지를 읽는 분석가입니다.`,
    `상품명: ${productName || '(미상)'}`,
    '',
    '이 이미지를 보고 아래 JSON 으로만 답하세요.',
    '',
    '{"facts": ["...", "..."], "bestH2Index": <숫자 또는 null>, "confidence": <0-100>, "hasProduct": <true 또는 false>}',
    '',
    '[hasProduct]',
    '- 이 사진에 **상품 실물이 찍혀 있으면** true.',
    '- 글자만 있는 안내문, 배송·교환·반품 정책, 브랜드 로고나 스토리 배너,',
    '  인증마크만 있는 그림처럼 **상품이 안 보이는 사진**이면 false.',
    '- 상품을 쓰고 있는 장면·부분 확대컷도 상품이 보이면 true.',
    '',
    '[facts]',
    '- 이미지에 **실제로 보이는 것만** 적으세요. 치수·재질·용량·개수·사용 조건처럼',
    '  구매 판단에 쓰이는 구체적인 사실 위주로 2~4개.',
    '- 사진에 없는 가격·할인율·출시일은 **절대 지어내지 마세요.**',
    '- 읽을 게 없으면 빈 배열 [] 로 두세요.',
    '- 한국어로, 한 항목은 40자 이내의 짧은 구로.',
    '',
    '[bestH2Index]',
    '- 아래 소제목 중 이 이미지가 **삽화로 가장 잘 어울리는** 것의 번호.',
    '- 어느 것에도 잘 안 맞으면 null.',
    list || '(소제목 없음)',
    '',
    '[confidence]',
    '- bestH2Index 확신도 0~100. 애매하면 낮게 주세요.',
  ].join('\n');
}

/** 모델 응답에서 JSON 을 안전하게 뽑는다 */
export function parseDetailJson(text: string, h2Titles: string[]): Omit<DetailImageFacts, 'imageUrl'> {
  // hasProduct 기본값은 true — 판정이 없다고 멀쩡한 사진을 버리면 손해가 더 크다
  const empty = { facts: [] as string[], bestH2: null as string | null, confidence: 0, hasProduct: true };
  if (!text) return empty;
  const cleaned = String(text).replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return empty;
  let obj: any;
  try { obj = JSON.parse(cleaned.slice(start, end + 1)); } catch { return empty; }

  const facts = Array.isArray(obj?.facts)
    ? obj.facts.map((f: any) => String(f || '').trim()).filter(Boolean).slice(0, 4)
    : [];
  const idx = Number.isInteger(obj?.bestH2Index) ? Number(obj.bestH2Index) : -1;
  const bestH2 = idx >= 0 && idx < h2Titles.length ? h2Titles[idx]! : null;
  const confRaw = Number(obj?.confidence);
  const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(100, Math.round(confRaw))) : 0;
  // 명시적으로 false 라고 답했을 때만 제외한다 (필드가 없으면 예전처럼 사용)
  const hasProduct = obj?.hasProduct === false ? false : true;
  return { facts, bestH2, confidence, hasProduct };
}

/** vendor 별 1회 질의 */
async function askVision(
  routing: VisionRouting,
  keys: DetailVisionOptions['apiKeys'],
  prompt: string,
  buf: Buffer,
  mime: string,
  timeoutMs: number,
): Promise<string> {
  if (routing.vendor === 'gemini') {
    if (!keys.gemini) throw new Error('gemini 키 없음');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${routing.model}:generateContent?key=${keys.gemini}`;
    const res = await httpsPostJson(url, {
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: buf.toString('base64') } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 400, responseMimeType: 'application/json' },
    }, {}, timeoutMs);
    return res?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (routing.vendor === 'claude') {
    if (!keys.claude) throw new Error('claude 키 없음');
    const res = await httpsPostJson('https://api.anthropic.com/v1/messages', {
      model: routing.model,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } },
          { type: 'text', text: `${prompt}\n\nJSON만 출력하세요.` },
        ],
      }],
    }, { 'x-api-key': keys.claude, 'anthropic-version': '2023-06-01' }, timeoutMs);
    return res?.content?.[0]?.text || '';
  }
  if (!keys.openai) throw new Error('openai 키 없음');
  const body: any = {
    model: routing.model,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } },
      ],
    }],
  };
  if (/^gpt-5/i.test(routing.model)) body.max_completion_tokens = 400;
  else body.max_tokens = 400;
  const res = await httpsPostJson('https://api.openai.com/v1/chat/completions', body,
    { Authorization: `Bearer ${keys.openai}` }, timeoutMs);
  return res?.choices?.[0]?.message?.content || '';
}

/**
 * 상세 이미지들을 분석한다. 실패는 조용히 건너뛴다(발행을 막지 않는다).
 * 비용은 `MAX_VISION_IMAGES` 장으로 묶인다.
 */
export async function analyzeDetailImages(
  imageUrls: string[],
  h2Titles: string[],
  productName: string,
  opts: DetailVisionOptions,
): Promise<DetailImageFacts[]> {
  const urls = (imageUrls || []).filter(Boolean).slice(0, MAX_VISION_IMAGES);
  if (urls.length === 0 || h2Titles.length === 0) return [];

  const routing = routeTextToVision(String(opts.textGenerator || 'gemini'));
  const timeoutMs = opts.timeoutMs ?? 30000;
  const prompt = buildDetailPrompt(h2Titles, productName);
  const out: DetailImageFacts[] = [];

  opts.onLog?.(`   🔍 상세 이미지 ${urls.length}장 분석 (${routing.provider}) — 이미지당 1회 호출`);

  for (const imageUrl of urls) {
    try {
      const buf = opts.fetchImageImpl
        ? await opts.fetchImageImpl(imageUrl)
        : await fetchImageBuffer(imageUrl);
      if (!buf) continue;
      const mime = detectMimeType(buf);
      const text = opts.askImpl
        ? await opts.askImpl(prompt, buf, mime)
        : await askVision(routing, opts.apiKeys, prompt, buf, mime, timeoutMs);
      const parsed = parseDetailJson(text, h2Titles);
      // v3.8.440: "상품이 안 보이는 사진"이라는 판정 자체가 결과다 — 사실이 없어도 기록해야
      //   아래 filterProductPhotos 가 그 사진을 걸러낼 수 있다.
      if (parsed.facts.length === 0 && !parsed.bestH2 && parsed.hasProduct) continue;
      out.push({ imageUrl, ...parsed });
    } catch (e: any) {
      // 한 장 실패가 나머지를 막지 않는다
      opts.onLog?.(`   ⚠️ 이미지 분석 실패(건너뜀): ${String(e?.message || e).slice(0, 50)}`);
    }
  }

  const withFacts = out.filter((r) => r.facts.length > 0).length;
  opts.onLog?.(`   ✅ 상세 이미지 분석 완료 — ${out.length}장 중 ${withFacts}장에서 사실 확보`);
  return out;
}

/**
 * 소제목별로 쓸 사진을 정한다. 한 사진은 한 곳에만 쓴다.
 * 확신도가 낮으면 배치하지 않는다 — 엉뚱한 사진이 붙는 것보다 없는 게 낫다.
 */
export function buildPlacementMap(
  results: DetailImageFacts[],
  normalizeKey: (s: string) => string,
): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  // 확신도 높은 것부터 자리를 잡는다
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  for (const r of sorted) {
    if (r.hasProduct === false) continue;   // v3.8.440: 상품이 안 보이는 사진은 삽화로 쓰지 않는다
    if (!r.bestH2 || r.confidence < PLACEMENT_CONFIDENCE_MIN) continue;
    if (used.has(r.imageUrl)) continue;
    const key = normalizeKey(r.bestH2);
    if (map[key]) continue;            // 그 소제목은 이미 사진이 있다
    map[key] = r.imageUrl;
    used.add(r.imageUrl);
  }
  return map;
}

/**
 * 상품이 안 보이는 사진을 후보에서 뺀다 (v3.8.440).
 *
 * 사용자 요구: "제품이미지가없는 이미지는 제외하고 제품이미지가있는이미지
 *   위주로 수집해줘"
 *
 * **분석되지 않은 사진은 그대로 남긴다.** vision 이 안 돌았거나(키 없음)
 * 장수 상한에 걸려 못 본 사진까지 버리면, 판정도 못 한 채 사진이 사라진다.
 * 여기서 빼는 건 "모델이 상품이 안 보인다고 명시한" 것뿐이다.
 *
 * 전부 걸러져 한 장도 안 남으면 **원본을 그대로 돌려준다** — 모델이 전부
 * false 로 답하는 오판 하나로 글에서 사진이 통째로 사라지면 안 된다.
 */
export function filterProductPhotos(urls: string[], results: DetailImageFacts[]): string[] {
  const rejected = new Set(
    results.filter((r) => r.hasProduct === false).map((r) => String(r.imageUrl || '')),
  );
  if (rejected.size === 0) return urls;
  const kept = urls.filter((u) => !rejected.has(String(u || '')));
  return kept.length > 0 ? kept : urls;
}

/**
 * 뽑아낸 사실을 본문 프롬프트에 실을 텍스트로 만든다.
 * 어느 소제목 것인지 태그를 달아 둔다 — 본문 생성이 한 번의 호출로
 * 모든 섹션을 만들기 때문에, 모델이 알아서 제자리에 녹여 넣게 하려면
 * 이 표시가 필요하다.
 */
export function formatDetailFactsForPrompt(results: DetailImageFacts[]): string {
  const withFacts = results.filter((r) => r.facts.length > 0);
  if (withFacts.length === 0) return '';
  const lines: string[] = [
    '',
    '📸 **상품 상세페이지(이미지)에서 실제로 확인한 사실**',
    '- 아래는 판매 페이지의 상세 이미지를 직접 읽어 얻은 내용입니다. **본문에 자연스럽게 녹여 쓰세요.**',
    '- 여기 없는 수치·가격·날짜는 지어내지 마세요.',
  ];
  for (const r of withFacts) {
    const tag = r.bestH2 ? `[${r.bestH2} 관련]` : '[공통]';
    lines.push(`  · ${tag} ${r.facts.join(' / ')}`);
  }
  return lines.join('\n');
}
