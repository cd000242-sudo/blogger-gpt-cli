/**
 * v3.8.506 — 사장님 보고 4건 배선 검사
 *
 * ① 제목 옵션 재설계: 셀렉트 삭제, 체크박스가 곧 진실, 낡은 직접입력 제목이 못 샌다
 * ② 발행 완료 시 1회성 필드(키워드·직접 제목)만 초기화 — 세팅은 유지
 * ③ 카드뉴스 발행 글 목록에 썸네일
 * ④ 첫 실행: 플랫폼이 비면 환경설정 모달 · 모달은 먼저 뜨고 내용은 병렬
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

describe('① 제목 옵션 — 체크박스 단일 소스', () => {
  const html = read('electron/ui/index.html');
  const posting = read('electron/ui/modules/posting.js');
  const queue = read('electron/ui/modules/publish-queue.js');

  it('제목 생성 모드 셀렉트가 사라졌다', () => {
    expect(html).not.toContain('<select id="titleMode">');
  });

  it('제목 옵션에 세 체크박스 + 직접 입력칸이 있다', () => {
    expect(html).toContain('id="useKeywordAsTitle"');
    expect(html).toContain('id="useCustomTitle"');
    expect(html).toContain('id="keywordFront"');
    expect(html).toContain('id="customTitle"');
  });

  it('키워드 제목과 직접 입력은 서로 배타이고, 직접 입력을 끄면 칸을 비운다', () => {
    expect(html).toContain('if (kw.checked) cu.checked = false');
    expect(html).toContain('if (cu.checked) kw.checked = false');
    // 낡은 글자가 남았다가 다른 경로로 새는 사고의 뿌리를 자르는 줄
    expect(html).toContain("if (!cu.checked && input) input.value = ''");
  });

  it('키워드를 제목으로 켜면 직접 입력은 선택지 자체가 사라진다 (v3.8.507)', () => {
    // 배타 처리로 회색 비활성만 하면 "왜 있는데 못 누르지"가 남는다 — 아예 숨긴다
    expect(html).toContain("cuLabel.style.display = kw.checked ? 'none' : ''");
  });

  it('getTitleOptions: 직접 입력이 꺼져 있으면 칸의 값은 절대 읽지 않는다', () => {
    expect(posting).toContain('function getTitleOptions()');
    expect(posting).toMatch(/const customValue = cuChecked\s*\n?\s*\? String/);
    expect(posting).toContain('window.__getTitleOptions = getTitleOptions');
  });

  it('단일 발행 payload 가 단일 소스를 쓴다 (셀렉트 직접 읽기 제거)', () => {
    expect(posting).toContain('const titleOptions = getTitleOptions()');
    expect(posting).not.toContain("getElementById('titleMode')");
  });

  it('큐도 같은 소스를 쓴다 — 경로마다 따로 조립하면 또 샌다', () => {
    expect(queue).toContain('window.__getTitleOptions?.()');
    expect(queue).not.toContain("getSelectValue('titleMode')");
  });

  it('직접 입력이 유효하면 키워드제목·맨앞배치는 자동으로 꺼진다', () => {
    expect(posting).toContain('useKeywordAsTitle: !isCustom && kwChecked');
    expect(posting).toMatch(/keywordFront: !isCustom && !kwChecked/);
  });
});

describe('② 발행 완료 후 필드 초기화', () => {
  const posting = read('electron/ui/modules/posting.js');

  it('완료일 때만 키워드·직접 제목 칸을 비운다 (중지 땐 유지)', () => {
    expect(posting).toContain("if (/완료/.test(String(reason)))");
    expect(posting).toContain("cleared.push('키워드 칸')");
    expect(posting).toContain("cleared.push('직접 제목 칸')");
  });

  it('완료 경로가 실제로 그 reason 으로 부른다', () => {
    expect(posting).toMatch(/resetArticleStateAfterPublish\('발행 완료'\)/);
    expect(posting).toMatch(/resetArticleStateAfterPublish\('콘텐츠 발행 완료'\)/);
  });
});

describe('③ 카드뉴스 발행 글 목록 썸네일', () => {
  const cn = read('electron/ui/modules/cardnews.js');

  it('썸네일 추출과 렌더가 실제로 있다', () => {
    expect(cn).toContain('function extractThumb');
    expect(cn).toMatch(/extractThumb\(p\)/);
    expect(cn).toMatch(/object-fit:\s*cover/);
  });
});

describe('④ 첫 실행·환경설정 모달', () => {
  const wizard = read('electron/ui/modules/first-run-wizard.js');
  const ui = read('electron/ui/modules/ui.js');

  it('1회성 플래그가 아니라 플랫폼 유무로 판정한다', () => {
    expect(wizard).toContain('const hasPlatform =');
    expect(wizard).toContain("pick('blogId'");
    expect(wizard).toContain("pick('wordpressSiteUrl'");
    expect(wizard).toContain("pick('tistoryBlogName'");
    // 예전 결함: 플래그 세팅 후 재검사 안 함
    expect(wizard).not.toContain("localStorage.getItem(WIZARD_COMPLETE_KEY)\n  if (completed === 'true') return");
  });

  it('환경설정 모달을 연다 (글포스팅 탭이 아니라)', () => {
    const fn = wizard.slice(wizard.indexOf('export async function checkFirstRun'), wizard.indexOf('function showFirstRunWizard'));
    expect(fn).toContain('window.openSettingsModal');
    expect(fn).not.toContain("showTab('settings')");
  });

  it('모달은 먼저 뜨고 내용은 병렬로 채운다', () => {
    const fn = ui.slice(ui.indexOf('export async function openSettingsModal'), ui.indexOf('export function closeSettingsModal'));
    const showIdx = fn.indexOf("modal.style.display = 'flex'");
    const agentIdx = fn.indexOf('ensureAgentModeSettingsReady');
    const loadIdx = fn.indexOf('loadSettingsContent');
    expect(showIdx).toBeGreaterThan(-1);
    // 표시가 로드들보다 앞이어야 한다 — 뒤면 예전처럼 대형 모듈 로드가 끝나야 뜬다
    expect(showIdx).toBeLessThan(agentIdx);
    expect(showIdx).toBeLessThan(loadIdx);
    expect(fn).toContain('Promise.allSettled');
  });
});
