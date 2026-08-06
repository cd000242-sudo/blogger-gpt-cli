/**
 * v3.8.465 — 이미지 오류가 "알 수 없는 오류"로 떨어져 발행이 즉시 차단되던 문제
 *
 * 사용자 화면(실측 스크린샷):
 *   "❌ 발행 실패: 엔진 고정 모드 — 이미지 생성 실패로 발행 차단됨:
 *    STRICT_ENGINE_FAILED:unknown:알 수 없는 오류: GPT Image 2 (덕테이프) 실패:
 *    OPENAI_HTTP_520: <!DOCTYPE html> <!--[if lt IE 7]> …"
 *
 * 무슨 일이 있었나:
 *   · 520 은 OpenAI 앞단 Cloudflare 가 내는 **일시 장애** 코드다.
 *   · 분류기가 500·503·504 만 알아서 520 은 unknown → bypassable:false →
 *     엔진 고정 모드에서 **재시도 0회로 즉시 발행 차단**됐다.
 *   · 정작 imageDispatcher 에는 "OpenAI 520 등 일시 장애" 를 위한 최후 폴백
 *     안전망(v3.8.358)이 있는데, unknown 이 그 앞에서 throw 해 도달하지 못했다.
 *   · 게다가 오류 본문이 HTML 이라 사용자에게 `<!DOCTYPE html>` 이 그대로 찍혔다.
 */
import { classifyImageError } from '../src/core/image-error-classifier';

describe('① 일시 장애(5xx)는 재시도한다', () => {
  const REAL = 'GPT Image 2 (덕테이프) 실패: OPENAI_HTTP_520: <!DOCTYPE html>';

  it('⭐⭐ 실제로 사용자가 받은 520 오류가 재시도 대상이 된다', () => {
    const c = classifyImageError(REAL);
    expect(c.bypassable).toBe(true);
    expect(c.category).not.toBe('unknown');
    expect(c.recommendedAction).toBe('retry_after_cooldown');
    expect(c.cooldownMs).toBeGreaterThan(0);
  });

  it('⭐⭐ 안내 문구가 사람이 읽을 수 있는 말이다', () => {
    const c = classifyImageError(REAL);
    expect(c.userMessage).not.toContain('<!DOCTYPE');
    expect(c.userMessage).not.toContain('알 수 없는 오류');
    expect(c.userMessage).toContain('일시');
  });

  it('⭐ Cloudflare 계열(521·522·524)도 같이 처리한다', () => {
    for (const status of [521, 522, 524, 527]) {
      const c = classifyImageError(`OPENAI_HTTP_${status}: origin unreachable`);
      expect(c.bypassable).toBe(true);
      expect(c.category).not.toBe('unknown');
    }
  });

  it('⭐⭐ 기존 5xx 분류는 그대로다 (회귀 방지)', () => {
    expect(classifyImageError('OPENAI_HTTP_503: overloaded').category).toBe('server_overload');
    expect(classifyImageError('OPENAI_HTTP_500: internal error').category).toBe('server_internal');
    expect(classifyImageError('HTTP_504 deadline_exceeded').category).toBe('server_timeout');
  });
});

describe('② 기다려도 안 풀리는 오류는 재시도하지 않고 할 일을 알려준다', () => {
  it('⭐⭐ 신분증(조직) 인증 미완료', () => {
    const c = classifyImageError('OPENAI_VERIFICATION_REQUIRED: gpt-image-2는 OpenAI 신분증 인증이 필요합니다.');
    expect(c.bypassable).toBe(false);
    expect(c.category).toBe('permission_denied');
    expect(c.userMessage).toContain('인증');
    expect(c.userMessage).not.toContain('알 수 없는');
  });

  it('⭐⭐ 할당량 초과 — quota 뒤가 한국어라 예전 규칙에 안 걸렸다', () => {
    const c = classifyImageError('OPENAI_QUOTA: 할당량/레이트리밋 초과');
    expect(c.category).not.toBe('unknown');
    expect(c.userMessage).not.toContain('알 수 없는');
  });

  it('⭐ 진짜로 모르는 오류만 unknown 이다', () => {
    expect(classifyImageError('무슨 말인지 알 수 없는 문자열 xyzzy').category).toBe('unknown');
  });
});

describe('③ 오류 본문이 HTML 이면 그대로 보여주지 않는다', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  const thumbnail = fs.readFileSync(path.join(__dirname, '..', 'src/thumbnail.ts'), 'utf-8');

  it('⭐⭐ HTML 응답은 사람이 읽을 문장으로 바꿔 싣는다', () => {
    expect(thumbnail).toContain('const looksHtml = /^\\s*(<!doctype|<html)/i.test(text);');
    expect(thumbnail).toContain('오류 안내 페이지를 돌려줬습니다');
  });
});
