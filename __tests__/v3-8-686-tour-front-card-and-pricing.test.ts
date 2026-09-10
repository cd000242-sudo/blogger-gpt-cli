/**
 * v3.8.686 — 사용법 투어: 카드 맨 앞 · 부드럽고 빠르게 · 완전자동발행 순서 · 네이버 API HUB 칸 · 가격표
 *
 * 사장님 (스크린샷 6장):
 *   "설명카드는 맨앞으로 와야지 그걸 읽는데 그게 어두워지면 어쩌니"
 *   "다음 누르면 부드럽고 빠르게 넘어가야 되는데 뚝 끊기면서 렉 걸렸다가 넘어가져 … 특히 느린 컴퓨터"
 *   "제미나이 3.6이 아니라 지피티 5.6 테라를 추천" · "지피티6 아스트라 나왔고 비용표 업데이트해"
 *   "네이버 API HUB 필드가 누락되어 있네 … 맨 아래로" · "지금 이 사용법은 완전자동발행이야"
 *
 * ## 카드가 어두워진 원인
 * 카드와 스포트라이트를 popover 두 개로 띄웠다. top layer 는 z-index 를 무시하고 **나중에 연 것이 위**다.
 * 단계마다 스포트라이트를 닫았다 다시 여니 매번 카드 위로 올라와 9999px 그림자가 카드를 덮었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';
import { TIER_MODELS, getPricingTable, tierCostKrw } from '../src/core/llm/pricing';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const tour = read('electron/ui/modules/usage-tour.js');
const html = read('electron/ui/index.html');
const settings = read('electron/ui/modules/settings.js');

// ══════════════════════════════════════════════════════════
describe('① 카드가 맨 앞에 온다', () => {
  it('⭐ popover 는 하나 — 스포트라이트를 따로 띄우지 않는다 (top layer 는 나중에 연 것이 위)', () => {
    expect(tour).not.toContain("spotEl.setAttribute('popover'");
    expect(tour).not.toContain("className = 'ut-spot'");
    expect(tour).not.toContain('.ut-spot {');
    expect((tour.match(/setAttribute\('popover', 'manual'\)/g) || []).length).toBe(1);
  });

  it('막 → 구멍 → 링 → 카드 앵커 순서로 한 popover 안에 그린다 (마지막이 맨 앞)', () => {
    expect(tour).toContain('<div class="ut-veil"></div><div class="ut-hole"></div><div class="ut-ring"></div><div class="ut-anchor"></div>');
    expect(tour).toContain('.ut-anchor { position:fixed; left:0; top:0; will-change:transform; z-index:2; }');
  });
});

// ══════════════════════════════════════════════════════════
describe('② 부드럽고 빠르게 (느린 PC 기준)', () => {
  it('고정 ms 대기가 없다', () => {
    expect(tour).not.toMatch(/await wait\(\d+\)/);
    expect(tour).not.toContain('const wait = ');
  });

  it('대상이 자리 잡을 때까지만 프레임 단위로 기다린다', () => {
    expect(tour).toContain('async function settle(targets');
    expect(braceBlock(tour, 'async function renderStep')).toContain('await settle(found)');
  });

  it('⭐ 연출은 막의 opacity 로만 돈다 — 9999px 그림자를 애니메이션하지 않는다', () => {
    const kf = blockBetween(tour, '@keyframes ut-reveal {', '}');
    expect(kf).toContain('opacity');
    expect(kf).not.toContain('box-shadow');
    expect(tour).not.toContain('.ut-hole.ut-reveal');
    expect(tour).toContain('.ut-veil.ut-reveal { animation:ut-reveal');
  });

  it('카드는 transform 으로 미끄러진다 (레이아웃 없음)', () => {
    expect(tour).toContain('.ut-anchor.ut-glide { transition:transform');
    expect(braceBlock(tour, 'function moveAnchor')).toContain('translate3d(');
    // 첫 배치는 미끄러지지 않는다 — (0,0) 에서 날아오면 안 된다
    expect(braceBlock(tour, 'function moveAnchor')).toContain('anchorPlaced && !instant');
  });

  it('스크롤·리사이즈 좌표 갱신은 한 프레임에 한 번', () => {
    const track = braceBlock(tour, 'function trackTargets');
    expect(track).toContain('requestAnimationFrame');
    expect(track).toContain('placeNear(targets, true)');
  });

  it('그려지지 않은 대상은 건너뛴다 (Agent 모드면 모델 카드·키 칸이 숨겨진다)', () => {
    const render = braceBlock(tour, 'async function renderStep');
    expect(render).toContain('const targets = found.filter(isDrawn)');
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 완전자동발행 순서', () => {
  const steps = blockBetween(tour, 'const STEPS = [', 'let tourIndex = 0');
  const order = [
    "sel: ['#nav-settings']",
    "sel: ['#executionModeApiBtn', '#executionModeAgentBtn']",
    "sel: ['#tierCardTerra']",
    "sel: ['#openaiKey']",
    "sel: ['#naverApiHubKeyId', '#naverApiHubKey']",
    "sel: ['#apiKeyGuideBtn']",
    "sel: ['#executionModeAgentBtn']",
    "sel: ['#settingsSaveBtn']",
    "sel: ['#nav-auto']",
    "sel: ['#keywordInput']",
    "sel: ['#postingSettingsToggleBtn']",
    "sel: ['#thumbnailType']",
    "sel: ['#h2ImageSource']",
    "sel: ['#strictH2ImageEngine']",
    "sel: ['#contentMode']",
    "sel: ['#toneStyle', '#experienceNote']",
    "sel: ['#useKeywordAsTitle']",
    "sel: ['#factCheckMode']",
    "sel: ['input[name=\"postingMode\"]']",
    "sel: ['#publishBtn']",
  ];

  it('⭐ 사장님이 준 순서대로 늘어선다', () => {
    let last = -1;
    order.forEach((sel) => {
      const i = steps.indexOf(sel, last + 1);
      expect(`${sel} → ${i}`).not.toBe(`${sel} → -1`);
      expect(i).toBeGreaterThan(last);
      last = i;
    });
  });

  it('모델 단계는 테라 카드, 키 단계는 OpenAI 칸을 가리킨다', () => {
    expect(steps).toContain("sel: ['#tierCardTerra']");
    expect(steps).toContain('지피티 5.6 테라');
    expect(steps).not.toContain("sel: ['#geminiKey']");
    expect(steps).not.toContain('제미나이 3.6');
  });

  it('이미지 엔진 단계는 상세설정 뒤, 이미지 탭에서 나온다 (설정 모달에서 가리키던 것을 옮겼다)', () => {
    expect(steps).toContain("before: () => goDetailTab('tab-image'), sel: ['#thumbnailType']");
    expect(steps).not.toContain("before: goSettingsModal, sel: ['#thumbnailType']");
  });

  it('저장·글포스팅·상세설정은 누르면 알아서 넘어간다', () => {
    expect(steps).toContain("sel: ['#settingsSaveBtn'], autoNext: true");
    expect(steps).toContain("sel: ['#postingSettingsToggleBtn'], autoNext: true");
  });

  it('마지막 행동은 완전자동발행 버튼 하나다', () => {
    expect(steps).toContain("sel: ['#publishBtn']");
    expect(steps).not.toContain("'#editGeneratedBtn'");
    expect(tour).toContain('완전자동발행');
  });

  it('⭐ 새 대상 id 가 실제로 있다 (없으면 그 단계가 조용히 사라진다)', () => {
    ['tierCardTerra', 'apiKeyGuideBtn', 'settingsSaveBtn', 'settingsCancelBtn', 'openaiKey', 'naverApiHubKeyId', 'naverApiHubKey', 'h2ImageSource', 'publishBtn']
      .forEach((id) => expect(html).toContain(`id="${id}"`));
  });
});

// ══════════════════════════════════════════════════════════
describe('④ 네이버 API HUB 칸 — 설정 모달 API 키 탭 (v3.8.714: 네이버 키 섹션 위로)', () => {
  const apiTab = blockBetween(html, 'id="tab-api-keys"', 'id="tab-platform"');

  it('⭐ HUB 칸이 API 키 탭 안에 있고, 숨김 카드에는 더 이상 없다', () => {
    expect(apiTab).toContain('id="naverApiHubKeyId"');
    expect(apiTab).toContain('id="naverApiHubKey"');
    expect((html.match(/id="naverApiHubKeyId"/g) || []).length).toBe(1);
    expect((html.match(/id="naverClientId"/g) || []).length).toBe(1);
  });

  /*
   * v3.8.714 — 사장님: "네이버 api 허브는 왜 에이전트 맨 아래에있니...?"
   *
   * v3.8.686 은 이 칸을 API 키 탭 **맨 아래**에 뒀다. 그런데 HUB 는 곁다리가 아니라
   * 지금의 표준이고(개발자센터 옛 키는 2027-06-30 종료), 같은 네이버 키인
   * 「키워드 분석 / 이미지 검색 API」 와 떨어져 맨 밑에 홀로 있으니 곁다리로 보였다.
   * 그래서 네이버 키 섹션 **바로 위**로 올렸다 — 표준을 먼저 보여준다.
   */
  it('네이버 키 섹션 위에 있다 — 곁다리가 아니라 표준이다', () => {
    const hub = apiTab.indexOf('id="naverApiHubKeyId"');
    expect(hub).toBeGreaterThan(apiTab.indexOf('id="openaiKey"'));      // AI 키들 뒤
    expect(hub).toBeLessThan(apiTab.indexOf('id="naverCustomerId"'));   // 옛 네이버 키 앞
    expect(hub).toBeLessThan(apiTab.indexOf('id="naverLoginBtn"'));
  });

  it('⭐ 옛 키도 같이 받고 저장·복원된다 (HUB 로 이관하는 동안 끊기지 않게)', () => {
    expect(apiTab).toContain('id="naverClientId"');
    expect(apiTab).toContain('id="naverClientSecret"');
    expect(settings).toContain("naverClientId: document.getElementById('naverClientId')?.value || ''");
    expect(settings).toContain("naverClientSecret: document.getElementById('naverClientSecret')?.value || ''");
    expect(settings).toContain("'naverClientId': pickSettingValue(mergedSettings, ['naverClientId', 'NAVER_CLIENT_ID'])");
    expect(settings).toContain("'naverClientSecret': pickSettingValue(mergedSettings, ['naverClientSecret', 'NAVER_CLIENT_SECRET'])");
  });

  it('발급 버튼이 API HUB 로 간다 (개발자센터 옛 주소면 새 사용자가 키를 못 받는다)', () => {
    expect(apiTab).toContain('window.openNaverApiPage && window.openNaverApiPage()');
    expect(read('electron/ui/modules/ui.js')).toContain("https://www.ncloud.com/product/applicationService/naverApiHub");
  });

  it('서비스 선택 경고가 칸 옆에 그대로 있다 (안 하면 키가 맞아도 429)', () => {
    const section = blockBetween(apiTab, 'id="naverSearchApiSection"', '<!-- 🔥 DOM 충돌 방지');
    expect(section).toContain('서비스 선택');
    expect(section).toContain('Search Trend');
    expect(section).toContain('2027-06-30');
  });
});

// ══════════════════════════════════════════════════════════
describe('⑤ 가격표 — GPT-6 Astra · 루나 인하 · 화면 라벨 일치', () => {
  it('Astra 가 있고 출시 단가로 계산된다', () => {
    const t = TIER_MODELS.find((m) => m.value === 'openai-gpt6-astra')!;
    expect(t).toBeTruthy();
    expect(t.modelId).toBe('gpt-6-astra');
    expect(t.provider).toBe('openai');
    expect(t.usdPer1M).toEqual(expect.objectContaining({ input: 10, output: 50 }));
    expect(tierCostKrw(t)).toBe(382);
  });

  it('루나 ₩8(80% 인하) · 테라 ₩81 · 솔 프로모션 ₩153', () => {
    const by = (v: string) => tierCostKrw(TIER_MODELS.find((m) => m.value === v)!);
    expect(by('openai-gpt4o-mini')).toBe(8);
    expect(by('openai-gpt41')).toBe(81);
    expect(by('openai-gpt4o')).toBe(153);
  });

  it('⭐ 화면의 정적 라벨·data-cost 가 단일 출처와 같다 (IPC 가 실패하면 이 값이 그대로 보인다)', () => {
    const table = getPricingTable();
    const picker = blockBetween(html, 'id="textEnginePicker"', '에이전트 (구독 · API 요금 없음)');
    const re = /<label[^>]*class="tier-card"[^>]*data-cost="(\d+)"[\s\S]*?value="([^"]+)"[\s\S]*?~₩([\d,]+)\/글/g;
    const seen: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(picker))) {
      const tier = table.find((t) => t.value === m![2]);
      expect(`${m[2]} 가 pricing.ts 에 있다`).toBe(tier ? `${m[2]} 가 pricing.ts 에 있다` : `${m[2]} 없음`);
      expect(Number(m[1])).toBe(tier!.costKrw);
      expect(Number(m[3].replace(/,/g, ''))).toBe(tier!.costKrw);
      seen.push(m[2]);
    }
    expect(seen).toEqual(expect.arrayContaining(table.map((t) => t.value)));
  });

  it('라벨 맵·비전 라우터도 Astra 를 안다', () => {
    expect(read('electron/ui/script.js')).toContain("'openai-gpt6-astra': { label: 'OpenAI GPT-6 Astra'");
    expect(read('src/core/url-image-crawler/visionRouter.ts')).toContain("case 'gpt-6-astra':");
  });
});
