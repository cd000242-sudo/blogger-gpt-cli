/**
 * v3.8.760 — 젠스파크 연결 부품의 판정 함수(브라우저 없이 시험할 수 있는 부분)
 * 실측(2026-10-10): 전송하면 주소가 agents?id=<uuid> 가 되고, /api/is_login 은 로그인 시 cogen_id·cogen_email 을 준다.
 */
import * as os from 'os';
import * as path from 'path';
import {
  projectIdFromUrl, readLoginResponse, buildGensparkPrompt, gensparkProfileDir, gensparkBrowserPath, DEEP_RESEARCH_URL, visibleUserAgent,
} from '../src/core/genspark/genspark-client';

describe('v3.8.760 젠스파크 연결 판정', () => {
  test('딥 리서치 진입 주소(실측)', () => {
    expect(DEEP_RESEARCH_URL).toBe('https://www.genspark.ai/agents?type=agentic_deep_research');
  });

  test('⭐ 전송 뒤 주소에서 내 작업 번호를 읽는다', () => {
    expect(projectIdFromUrl('https://www.genspark.ai/agents?id=73484b4f-fa01-436c-b313-eeeae4c7be28')).toBe('73484b4f-fa01-436c-b313-eeeae4c7be28');
    expect(projectIdFromUrl('https://www.genspark.ai/agents?type=agentic_deep_research')).toBe('');
    expect(projectIdFromUrl('not a url')).toBe('');
  });

  test('로그인 응답 읽기 — 계정 번호가 있어야 로그인', () => {
    expect(readLoginResponse({ status: 0, data: { cogen_id: 'abc', cogen_email: 'a@b.c' } })).toEqual({ loggedIn: true, email: 'a@b.c' });
    expect(readLoginResponse({ cogen_id: 'abc', cogen_name: 'x' })).toEqual({ loggedIn: true, email: '' });
    expect(readLoginResponse({ status: -1, data: {} })).toEqual({ loggedIn: false, email: '' });
    expect(readLoginResponse(null)).toEqual({ loggedIn: false, email: '' });
  });

  test('조사 지시문에 키워드·공식 자료 우선·출처 요구가 들어간다', () => {
    const p = buildGensparkPrompt('청년미래적금 2차 신청 조건');
    expect(p).toContain('청년미래적금 2차 신청 조건');
    expect(p).toContain('공식');
    expect(p).toContain('출처');
    expect(buildGensparkPrompt('   ')).toBe('');
  });

  /** 실측(2026-10-10): 화면 없는 크롬은 이름에 HeadlessChrome 을 달아 Cloudflare 봇 확인에 걸렸다. 이름만 고치면 통과 */
  test('⭐ 화면 없는 브라우저 이름에서 Headless 만 뺀다 — 버전은 그대로', () => {
    const headless = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.8059.39 Safari/537.36';
    expect(visibleUserAgent(headless)).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.39 Safari/537.36');
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0';
    expect(visibleUserAgent(edge)).toContain('Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0');
    expect(visibleUserAgent(edge)).not.toContain('Headless');
  });

  test('프로필은 사용자 폴더의 .blogger-gpt/genspark-profile (Dropshot 과 같은 자리 규칙)', () => {
    expect(gensparkProfileDir()).toBe(path.join(os.homedir(), '.blogger-gpt', 'genspark-profile'));
  });

  test('브라우저는 앱이 시작할 때 찾아 둔 크롬·엣지 경로를 쓴다 — 없으면 빈 값', () => {
    expect(gensparkBrowserPath({ PUPPETEER_EXECUTABLE_PATH: __filename })).toBe(__filename);
    expect(gensparkBrowserPath({ PUPPETEER_EXECUTABLE_PATH: 'C:/없는/경로/chrome.exe' })).toBe('');
    expect(gensparkBrowserPath({})).toBe('');
  });
});
