const fs = require('fs');
const path = require('path');

import { braceBlock, blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.646 — 발행마다 엔진이 무작위로 바뀌던 문제.
 *
 * 사장님: "엔진 문제는 뭔문제니? 심층분석해봐"
 *
 * 실측 2026-09-05 (10편 생성): 4편이 엔진 때문에 죽었다(Gemini 3 · Claude 1).
 * 같은 키워드가 어떤 실행은 성공하고 어떤 실행은 실패했다 — 제비뽑기였다.
 *
 * ## 왜
 * adsense 모드면 `payload.llmRotation = payload.llmRotation !== false` 였다.
 * 즉 **값을 안 실으면 자동 ON**. 그리고 로테이션 후보는 "키가 env 에 있으면" 들어간다 —
 * 그 키가 살아 있는지는 안 본다. 사장님 Gemini 키는 유출 차단 상태다.
 *
 * ## 경로마다 달랐다
 *   단일 발행(run-post)  : 화면이 llmRotation:false 를 실어 보낸다 → 꺼짐
 *   다중계정(postPayload): 새로 조립하며 이 값을 안 싣는다      → **몰래 켜짐**
 *   재생성(args.payload) : 스프레드라 있으면 유지, 없으면       → **몰래 켜짐**
 *
 * 화면에서는 진작 꺼져 있었고, payload 를 다시 만드는 경로에서만 켜져 있었다.
 */
describe('v3.8.646 엔진 로테이션', () => {
  const orch = read('src/core/final/orchestration.ts');

  describe('켜 달라고 해야 켜진다', () => {
    test('값을 안 실으면 꺼진 채로 간다', () => {
      expect(orch).toContain('payload.llmRotation = payload.llmRotation === true;');
      expect(orch).not.toContain('payload.llmRotation = payload.llmRotation !== false');
    });

    /** 켜는 길 자체를 막은 건 아니다 — 명시적으로 true 를 주면 돈다 */
    test('로테이션 기능 자체는 남아 있다', () => {
      expect(orch).toContain("payload?.llmRotation === true && payload?.contentMode === 'adsense'");
      expect(orch).toContain('[ROTATION]');
    });

    /** 왜 껐는지가 코드에 남아 있어야 다음 사람이 되돌리지 않는다 */
    test('끈 이유가 적혀 있다', () => {
      const block = blockBetween(orch, 'v3.8.646', 'payload.llmRotation = payload.llmRotation === true;');
      expect(block).toContain('유출 차단');
      expect(block).toContain('다중계정');
    });
  });

  describe('죽은 엔진을 기본값으로 두지 않는다', () => {
    const posting = read('electron/ui/modules/posting.js');

    /** 기본값이 gemini 였다 — 그 키는 차단 상태라 기본값을 타면 그대로 실패한다 */
    test('payload 기본 provider 가 gemini 가 아니다', () => {
      const defaults = braceBlock(posting, 'const PAYLOAD_DEFAULTS = {');
      expect(defaults).toContain("provider: 'openai'");
      expect(defaults).not.toContain("provider: 'gemini'");
    });
  });

  describe('로테이션이 켜졌을 때의 후보 규칙', () => {
    /**
     * 후보는 키가 있는지만 본다. 살아 있는지는 모른다 — 그래서 켤 때는
     * 그 사실을 알고 켜야 한다. 이 검사는 규칙이 바뀌면 알려 주는 용도다.
     */
    test('키가 있으면 후보에 넣는다는 사실을 못박아 둔다', () => {
      const block = blockBetween(orch, "if (payload?.llmRotation === true", 'payload.primaryGeminiTextModel = providerModelMap[picked]');
      expect(block).toContain("envCheck('GEMINI_API_KEY')");
      expect(block).toContain('candidates.length >= 2');
    });
  });
});
