/**
 * v3.8.596 — URL 을 넣으면 **그 글의 상위호환**을 쓴다.
 *
 * 사장님: "url을 넣으면 그 블로그를 적는 게 아니라 그 블로그에서 적은 글을 파악하고
 *          확인해서 그 글보다 더 상위호환으로 작성해야지"
 *
 * 예전 프롬프트는 목표가 **다름**이었다("완전히 다른 제목", "완전히 다른 소제목",
 * "새 관점으로 재작성"). 다르라고 시키면 주제에서 멀어진다.
 */

import { buildUpgradeBrief, URL_UPGRADE_RULES, URL_UPGRADE_TITLE_RULES } from '../src/core/final/url-upgrade';

const SOURCE = {
  title: '혁신성장촉진자금 비즈스캔 총정리! 신청·조건·실사·서류',
  content: '혁신성장촉진자금은 소상공인 직접대출입니다. '.repeat(40),
  subheadings: ['혁신성장촉진자금이란?', '일반형과 혁신형 차이', '신청 절차'],
  url: 'https://blog.naver.com/la1826/224394201101',
};

describe('원문 브리핑', () => {
  test('제목·다룬 항목·본문이 모두 들어간다', () => {
    const brief = buildUpgradeBrief(SOURCE);
    expect(brief).toContain('우리가 이겨야 할 글');
    expect(brief).toContain(SOURCE.title);
    expect(brief).toContain('일반형과 혁신형 차이');
    expect(brief).toContain('혁신성장촉진자금은 소상공인 직접대출입니다.');
  });

  test('본문은 정해진 길이까지만 싣는다', () => {
    const brief = buildUpgradeBrief(SOURCE, 100);
    expect(brief.length).toBeLessThan(600);
  });

  test('소제목이 없어도 깨지지 않는다', () => {
    const brief = buildUpgradeBrief({ ...SOURCE, subheadings: [] });
    expect(brief).toContain(SOURCE.title);
    expect(brief).not.toContain('원문이 다룬 항목');
  });
});

describe('상위호환 규칙', () => {
  test('목표가 "다름"이 아니라 "나음"이다', () => {
    expect(URL_UPGRADE_RULES).toContain('상위호환');
    expect(URL_UPGRADE_RULES).toContain('같은 주제, 같은 검색 의도');
    expect(URL_UPGRADE_RULES).not.toContain('완전히 다른');
    // "새 관점"은 이제 **금지 대상**으로만 등장한다 (예전엔 요구사항이었다)
    expect(URL_UPGRADE_RULES).toContain('새 관점으로 비틀지 마세요');
  });

  test('원문이 다룬 것을 덮고, 빠뜨린 것을 채우라고 말한다', () => {
    expect(URL_UPGRADE_RULES).toContain('빠짐없이 다룹니다');
    expect(URL_UPGRADE_RULES).toContain('빠뜨린 것을 채웁니다');
  });

  test('그 블로그를 글의 소재로 삼지 말라고 못 박는다 — 사고의 핵심', () => {
    expect(URL_UPGRADE_RULES).toContain('글의 소재로 삼지 마세요');
    expect(URL_UPGRADE_RULES).toContain('원문에 따르면');
  });

  test('문장 복사 금지는 그대로 남아 있다 (중복 문서)', () => {
    expect(URL_UPGRADE_RULES).toContain('복사하지 않습니다');
  });

  test('제목 규칙 — 주제를 바꾸지 말고, 개수를 약속하지 마라', () => {
    expect(URL_UPGRADE_TITLE_RULES).toContain('주제를 바꾸지 마세요');
    expect(URL_UPGRADE_TITLE_RULES).toContain('개수를 약속하지 마세요');
    expect(URL_UPGRADE_TITLE_RULES).not.toContain('완전히 다른');
  });
});

describe('URL 생성기에 실제로 배선됐는가', () => {
  const loadWithMocks = (html: string) => {
    jest.resetModules();
    const prompts: string[] = [];
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { get: jest.fn(async () => ({ data: html })) },
    }));
    jest.doMock('../src/core/final/gemini-engine', () => ({
      callGeminiWithRetry: jest.fn(async (prompt: string) => {
        prompts.push(prompt);
        return JSON.stringify({
          title: '혁신성장촉진자금 신청 전에 확인할 것',
          metaDescription: '설명',
          tags: ['혁신성장촉진자금'],
          h2Sections: [{
            title: '누가 받을 수 있나',
            h3Sections: [{ title: '대상', content: '내용'.repeat(60) }],
          }],
        });
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../src/core/url-content-generator');
    return { mod, prompts };
  };

  afterEach(() => {
    jest.dontMock('axios');
    jest.dontMock('../src/core/final/gemini-engine');
    jest.resetModules();
  });

  test('통합 생성 프롬프트가 상위호환 규칙을 싣는다', async () => {
    const html = `<html><head><title>${SOURCE.title}</title></head>
      <body><article><p>${SOURCE.content}</p></article></body></html>`;
    const { mod, prompts } = loadWithMocks(html);

    await mod.generateContentFromUrl('https://example.com/post', undefined, () => { });

    const all = prompts.join('\n');
    expect(all).toContain('상위호환');
    expect(all).toContain('글의 소재로 삼지 마세요');
    expect(all).toContain('우리가 이겨야 할 글');
    // 예전 지시가 남아 있으면 안 된다
    expect(all).not.toContain('완전히 새로운 블로그 글');
    expect(all).not.toContain('새 관점과 새 문장으로 재작성');
  });
});
