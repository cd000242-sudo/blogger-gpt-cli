/**
 * v3.8.544 — 사장님 실보고 4건 + 신규 기능 2건
 *
 *  ① 헤더 배지 드롭다운이 안 열린다 (v3.8.534/535 가 두 번 실패한 그 건)
 *  ② 배지로 플랫폼을 바꿔도 되돌아간다 / 재시작하면 사라진다
 *  ③ 연속발행 큐 항목 카드에 디스커버 모드가 없다 (v3.8.524 가 세 자리 중 두 자리만 고침)
 *  ④ 네이버 프리미엄콘텐츠를 외부유입 채널로 추가
 *  ⑤ 허브 헌장 — 단일 일관 모드 허브글의 존재 이유가 한 문장으로 안 서면 발행 중단
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  validateHubJob, buildHubCharterSentence, parseHubJob, buildHubJobPrompt,
  buildHubCharterBlock, isHubCharterEnforced, formatHubCharterBlockMessage,
  HUB_JOB_MIN_CHARS, HUB_JOB_MAX_CHARS,
} from '../src/core/final/hub-charter';
import { braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const badges = read('electron/ui/modules/header-badges.js');
const html = read('electron/ui/index.html');
const css = read('electron/ui/styles.css');
const queue = read('electron/ui/modules/publish-queue.js');
const extUi = read('electron/ui/modules/external-traffic.js');
const orchestration = read('src/core/final/orchestration.ts');

// ══════════════════════════════════════════════════════════
describe('① 배지 팝오버가 화면에 실제로 나온다', () => {
  it('근거: 헤더와 배지 둘 다 backdrop-filter 를 갖는다 — fixed 자손의 컨테이닝 블록이 된다', () => {
    // 이 두 줄이 참인 한, 팝오버를 배지 안에 두면 fixed 여도 뷰포트 기준이 되지 않는다.
    expect(css).toMatch(/\.app-header\s*\{[^}]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/\.header-badge\s*\{[^}]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/\.app-header\s*\{[^}]*overflow-y:\s*hidden/);
  });

  it('그래서 팝오버를 document.body 에 붙인다 (배지 안이 아니라)', () => {
    expect(badges).toContain('document.body.appendChild(pop)');
    expect(badges).not.toContain('badge.appendChild(pop)');
  });

  it('fixed + 좌표 계산은 그대로 유지된다 (v3.8.535 의 나머지 절반)', () => {
    expect(badges).toContain('position:fixed');
    expect(badges).toContain('getBoundingClientRect()');
  });

  it('팝오버가 body 로 나갔으므로 바깥 클릭 판정에 .hb-pop 이 포함된다', () => {
    // 안 그러면 팝오버 제목줄만 눌러도 닫힌다
    expect(badges).toContain(".closest('.hb-pop')");
  });
});

// ══════════════════════════════════════════════════════════
describe('② 배지로 바꾼 값이 되돌아가지 않는다', () => {
  it('근거: resolvePlatformValue 는 저장된 bloggerSettings 를 .env 보다 먼저 본다', () => {
    const settings = read('electron/ui/modules/settings.js');
    const fn = settings.slice(settings.indexOf('function resolvePlatformValue'));
    const savedIdx = fn.indexOf('savedRaw');
    const envIdx = fn.indexOf('envRaw');
    expect(savedIdx).toBeGreaterThan(-1);
    expect(envIdx).toBeGreaterThan(savedIdx); // 저장값이 먼저 → .env 만 고치면 무효
  });

  it('그래서 배지는 .env 와 bloggerSettings 두 곳에 함께 쓴다', () => {
    expect(badges).toContain('mergeIntoLocalSettings');
    expect(badges).toContain("mergeIntoLocalSettings({ platform: value })");
    expect(badges).toContain('primaryGeminiTextModel: value');
    // .env 저장도 그대로 살아 있다
    expect(badges).toContain('saveEnv?.({ platform: value })');
  });

  it('병합 저장이다 — 넘긴 키만 덮고 나머지는 보존한다', () => {
    expect(badges).toContain('{ ...current, ...patch }');
  });

  it('화면 갱신은 selectPlatform 에 맡긴다 — 카드·필드까지 같이 움직여야 "바뀐" 것이다', () => {
    expect(badges).toContain('window.selectPlatform');
    expect(badges).toContain('window.updateAiModelStatus');
  });

  it('전체 saveSettings 는 여전히 금지 (모달 미오픈 시 빈 필드 위험)', () => {
    expect(badges).not.toMatch(/import[^;]*\bsaveSettings\b[^;]*from/);
  });
});

describe('②-b id="platformStatus" 중복 제거', () => {
  it('index.html 에 platformStatus 는 단 하나 — 헤더 배지뿐이다', () => {
    const count = (html.match(/id="platformStatus"/g) || []).length;
    expect(count).toBe(1);
  });

  it('설정 박스 설명줄은 platformStatusDesc 로 분리됐다', () => {
    expect(html).toContain('id="platformStatusDesc"');
  });

  it('설정 박스용 문구를 쓰는 코드는 전부 Desc 를 가리킨다', () => {
    // 헤더 배지에 "Google 블로그 플랫폼" 같은 설명이 새어 들어가면 안 된다
    for (const marker of ['Google 블로그 플랫폼', '✅ 연동 확인됨', '자체 호스팅 블로그 플랫폼']) {
      const idx = html.indexOf(marker);
      expect(idx).toBeGreaterThan(-1);
    }
    // 남은 getElementById('platformStatus') 는 헤더 배지 초기화 1곳뿐
    const hits = (html.match(/getElementById\('platformStatus'\)/g) || []).length;
    expect(hits).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 연속발행 큐 — 디스커버 모드가 세 자리 모두에 있다', () => {
  it('항목 카드 드롭다운(pq-item-mode)에 discover 옵션이 있다', () => {
    const start = queue.indexOf('class="pq-item-mode"');
    expect(start).toBeGreaterThan(-1);
    const block = queue.slice(start, queue.indexOf('</select>', start));
    expect(block).toContain('value="discover"');
  });

  it('일괄변경 드롭다운(pq-bulk-mode)에도 있다', () => {
    const start = queue.indexOf('id="pq-bulk-mode"');
    const block = queue.slice(start, queue.indexOf('</select>', start));
    expect(block).toContain('value="discover"');
  });

  it('라벨 표에도 있다 — 영문 "discover" 로 뜨지 않게', () => {
    expect(queue).toContain("discover: '구글 디스커버'");
  });

  it('항목 카드가 지원하는 모드가 라벨 표를 벗어나지 않는다', () => {
    const start = queue.indexOf('class="pq-item-mode"');
    const block = queue.slice(start, queue.indexOf('</select>', start));
    const values = Array.from(block.matchAll(/value="([a-z]+)"/g)).map((m) => m[1]);
    expect(values.sort()).toEqual(
      ['adsense', 'discover', 'external', 'internal', 'paraphrasing', 'shopping'].sort(),
    );
  });
});

// ══════════════════════════════════════════════════════════
describe('④ 네이버 프리미엄콘텐츠 채널', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dispatcher = require('../src/core/external-traffic/index.js');
  const CHANNEL_ID = 'naver-premium-content';

  it('디스패처에 등록돼 listChannels 에 나온다', () => {
    const found = dispatcher.listChannels().find((c: any) => c.id === CHANNEL_ID);
    expect(found).toBeTruthy();
    expect(found.name).toBe('네이버 프리미엄콘텐츠');
    expect(found.category).toBe('naver');
  });

  it('UI 목록의 id 가 채널 id 와 정확히 같다 — 어긋나면 조용히 v1 폴백으로 떨어진다', () => {
    expect(extUi).toContain(`id: '${CHANNEL_ID}'`);
    // _V2_CHANNELS 는 listChannels() 로 채워지므로 id 일치가 v2 사용의 유일한 조건이다
    expect(extUi).toContain('_V2_CHANNELS = new Set(result.channels.map((c) => c.id))');
  });

  it('로고 표에도 있다 — 없으면 아이콘이 물음표로 뜬다', () => {
    expect(extUi).toContain(`'${CHANNEL_ID}': { slug: 'naver'`);
  });

  it('프롬프트 쌍이 실제로 만들어진다', () => {
    const pair = dispatcher.buildPromptPair(CHANNEL_ID, {
      sourceSummary: dispatcher.buildMinimalSummary('전세보증금 반환보증 거절 사유', '보증료 0.128%'),
      sourceUrl: 'https://example.com/a',
      sourceTitle: '전세보증금 반환보증 거절 사유',
    });
    expect(pair.system.length).toBeGreaterThan(200);
    expect(pair.user).toContain('https://example.com/a');
    expect(pair.maxOutputTokens).toBeGreaterThan(0);
  });

  it('구독 구걸·장식어 제목을 금지한다 (이 판의 성격상 즉시 이탈)', () => {
    const ch = dispatcher.getChannel(CHANNEL_ID);
    expect(ch.bannedPhrases).toEqual(expect.arrayContaining(['구독 부탁드립니다']));
    expect(ch.buildSystemPrompt()).toContain('총정리');
  });

  it('심사·링크정책 미확인 사실을 사용자에게 알린다 (추측을 규칙처럼 박지 않는다)', () => {
    const ch = dispatcher.getChannel(CHANNEL_ID);
    expect(ch.confidence).toBe('inferred');
    expect(ch.userWarning).toContain('심사');
  });
});

// ══════════════════════════════════════════════════════════
describe('⑤ 허브 헌장 — 판정 규칙', () => {
  const KW = '전세사기 피해주택 경매';
  const GOOD = '전세사기 피해주택을 낙찰받은 사람이 시간순으로 무엇을 확인해야 하는지';

  it('사장님이 든 예시가 통과한다', () => {
    const v = validateHubJob(GOOD, { keyword: KW, subCount: 7 });
    expect(v.violations).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('통과하면 문장 틀은 코드가 고정한다 — 개수·"요약이 아니라"가 항상 들어간다', () => {
    const v = validateHubJob(GOOD, { keyword: KW, subCount: 7 });
    expect(v.sentence).toBe(
      `이 허브는 7개의 하위 콘텐츠를 연결하지만, 기존 글의 요약이 아니라 "${GOOD}"를 해결한다.`,
    );
  });

  it('빈 값은 사유가 아니다', () => {
    expect(validateHubJob('', { keyword: KW, subCount: 3 }).ok).toBe(false);
    expect(validateHubJob(null, { keyword: KW, subCount: 3 }).ok).toBe(false);
    expect(validateHubJob(undefined, { keyword: KW, subCount: 3 }).ok).toBe(false);
  });

  it('장식어뿐이면 반려 — "총정리"는 존재 이유가 아니다', () => {
    const v = validateHubJob('전세사기 피해주택 경매 총정리', { keyword: KW, subCount: 5 });
    expect(v.ok).toBe(false);
    expect(v.violations.join(' ')).toMatch(/장식어|짧|키워드/);
  });

  it('요약이라고 말하면 반려 — 사장님이 명시적으로 배제한 것', () => {
    const v = validateHubJob('기존 글들을 요약해 낙찰받은 사람이 순서대로 보게 하는 것', { keyword: KW, subCount: 7 });
    expect(v.ok).toBe(false);
    expect(v.violations.join(' ')).toContain('요약');
  });

  it('대상이 없으면 반려 — "누구를 위한 것인가"가 빠졌다', () => {
    const v = validateHubJob('시간순으로 무엇을 확인해야 하는지 정리하기', { keyword: KW, subCount: 4 });
    expect(v.ok).toBe(false);
    expect(v.violations.join(' ')).toContain('누구를 위한');
  });

  it('무엇을 정하게 되는지가 없으면 반려', () => {
    const v = validateHubJob('낙찰받은 사람이 겪는 마음고생과 주변 반응에 대한 이야기', { keyword: KW, subCount: 4 });
    expect(v.ok).toBe(false);
    expect(v.violations.join(' ')).toContain('무엇을 정하게');
  });

  it('키워드를 되풀이한 것뿐이면 반려', () => {
    const v = validateHubJob('전세사기 피해주택 경매에 대한 것', { keyword: KW, subCount: 6 });
    expect(v.ok).toBe(false);
  });

  it('두 문장이면 반려 — 한 문장으로 안 되면 허브의 초점이 둘이다', () => {
    const v = validateHubJob(
      '낙찰받은 사람이 순서를 확인한다. 그리고 세금도 판단한다',
      { keyword: KW, subCount: 7 },
    );
    expect(v.ok).toBe(false);
    expect(v.violations.join(' ')).toContain('두 문장');
  });

  it(`길이 밖이면 반려 (${HUB_JOB_MIN_CHARS}~${HUB_JOB_MAX_CHARS}자)`, () => {
    expect(validateHubJob('낙찰자 순서', { keyword: KW, subCount: 3 }).ok).toBe(false);
    const tooLong = `낙찰받은 사람이 시간순으로 무엇을 확인해야 하는지 ${'그리고 또 무엇을 판단해야 하는지 '.repeat(6)}`;
    const v = validateHubJob(tooLong, { keyword: KW, subCount: 3 });
    expect(v.ok).toBe(false);
    expect(v.violations.join(' ')).toContain('한 문장을 넘어');
  });

  it('AI 가 붙여 보내는 껍데기(JOB:, 따옴표, 마침표, "~를 해결한다")를 벗긴다', () => {
    const raw = `JOB: "${GOOD}를 해결한다."`;
    const v = validateHubJob(parseHubJob(raw), { keyword: KW, subCount: 7 });
    expect(v.ok).toBe(true);
    expect(v.job).toBe(GOOD);
  });

  it('JOB: 형식을 안 지켜도 첫 줄을 쓴다', () => {
    expect(parseHubJob(`\n\n${GOOD}\n부연 설명입니다`)).toBe(GOOD);
  });

  it('하위 글이 0개여도 문장이 성립한다 (첫 허브)', () => {
    const v = validateHubJob(GOOD, { keyword: KW, subCount: 0 });
    expect(v.ok).toBe(true);
    expect(v.sentence).toContain('하위 콘텐츠를 연결하지만');
    expect(v.sentence).not.toContain('0개');
  });
});

describe('⑤-b 허브 헌장 — 프롬프트와 주입', () => {
  const KW = '전세사기 피해주택 경매';
  const SUBS = [{ title: '전세사기 피해자 요건' }, { title: '경매 배당요구 기한' }];

  it('프롬프트가 하위 글 제목을 실제로 싣는다 (유령 키 사고 방지)', () => {
    const p = buildHubJobPrompt({ keyword: KW, subContents: SUBS });
    expect(p).toContain('전세사기 피해자 요건');
    expect(p).toContain('경매 배당요구 기한');
    expect(p).toContain('JOB:');
  });

  it('재시도 프롬프트는 반려 사유를 되먹인다', () => {
    const p = buildHubJobPrompt({ keyword: KW, subContents: SUBS, previousViolations: ['대상이 없습니다'] });
    expect(p).toContain('직전 시도가 반려된 이유');
    expect(p).toContain('대상이 없습니다');
  });

  it('통과한 헌장은 본문 프롬프트에 실린다 — 게이트만 통과시키고 끝나면 글은 그대로다', () => {
    const v = validateHubJob('낙찰받은 사람이 시간순으로 무엇을 확인해야 하는지', { keyword: KW, subCount: 2 });
    const block = buildHubCharterBlock(v, SUBS);
    expect(block).toContain(v.sentence);
    expect(block).toContain('전세사기 피해자 요건');
    expect(block).toContain('허브 헌장');
  });

  it('반려된 헌장은 아무것도 주입하지 않는다', () => {
    const v = validateHubJob('총정리', { keyword: KW, subCount: 2 });
    expect(buildHubCharterBlock(v, SUBS)).toBe('');
  });

  it('차단 메시지는 이유와 끄는 법을 함께 알려준다 (조용히 죽지 않게)', () => {
    const msg = formatHubCharterBlockMessage(KW, ['대상이 없습니다']);
    expect(msg).toContain(KW);
    expect(msg).toContain('대상이 없습니다');
    expect(msg).toContain('HUB_CHARTER_ENFORCE=false');
  });

  it('기본은 차단 ON, env/payload 로만 끈다', () => {
    expect(isHubCharterEnforced({})).toBe(true);
    expect(isHubCharterEnforced({ HUB_CHARTER_ENFORCE: 'true' })).toBe(true);
    expect(isHubCharterEnforced({ HUB_CHARTER_ENFORCE: 'false' })).toBe(false);
    expect(isHubCharterEnforced({ HUB_CHARTER_ENFORCE: '0' })).toBe(false);
    expect(isHubCharterEnforced({}, { hubCharterEnforce: false })).toBe(false);
  });

  it('문장 틀 자체가 "요약이 아니다"를 못 박는다', () => {
    expect(buildHubCharterSentence('낙찰받은 사람이 순서를 확인하는 법', 7))
      .toContain('기존 글의 요약이 아니라');
  });
});

describe('⑤-c 허브 헌장 — 배선', () => {
  it('단일 일관 모드(internal)에만 걸린다 — 다른 모드는 허브가 아니다', () => {
    expect(orchestration).toContain("if (contentMode === 'internal') {");
    // 고정 길이 슬라이스 금지 — 블록 경계로 자른다
    const block = braceBlock(orchestration, '🧭 v3.8.544');
    expect(block).toContain('isHubCharterEnforced');
    expect(block).toContain('validateHubJob');
  });

  it('본문 생성 전에 막는다 — 비싼 호출 뒤에 막으면 돈이 샌다', () => {
    const hubIdx = orchestration.indexOf('🧭 v3.8.544');
    const sectionIdx = orchestration.indexOf('generateSectionContentFinal');
    expect(hubIdx).toBeGreaterThan(-1);
    if (sectionIdx > -1) expect(hubIdx).toBeLessThan(sectionIdx);
  });

  it('재요청은 실패했을 때만 1회 — 평상시 추가 호출은 1회뿐', () => {
    // 고정 길이 슬라이스 금지 — 블록 경계로 자른다
    const block = braceBlock(orchestration, '🧭 v3.8.544');
    expect(block).toContain('attempt <= 2');
    expect(block).toContain('if (verdict.ok) break;');
  });

  it('막을 때 화면과 콘솔 양쪽에 이유를 남긴다 (예약 발행이 조용히 죽지 않게)', () => {
    // 고정 길이 슬라이스 금지 — 블록 경계로 자른다
    const block = braceBlock(orchestration, '🧭 v3.8.544');
    expect(block).toContain('onLog?.(message)');
    expect(block).toContain('[HUB-CHARTER] ⛔');
    expect(block).toContain('throw new Error(message)');
  });

  it('통과한 헌장을 결과에 실어 남긴다', () => {
    expect(orchestration).toContain('hubCharter: hubCharterSentence');
  });

  it('하위 콘텐츠 조회를 두 번 하지 않는다 — 중복 회피와 같은 결과를 쓴다', () => {
    expect((orchestration.match(/findRelatedPosts\(dupSiteUrl/g) || []).length).toBe(1);
    expect(orchestration).toContain('relatedForHub');
  });
});
