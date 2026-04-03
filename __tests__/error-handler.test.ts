/**
 * ErrorHandler 유닛 테스트
 */
import { ErrorHandler } from '../src/utils/error-handler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── withRetry ─────────────────────────────────────

  describe('withRetry', () => {
    it('성공 시 즉시 반환', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await ErrorHandler.withRetry(fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('재시도 가능한 에러 시 maxRetries만큼 재시도', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout error'))
        .mockResolvedValue('recovered');

      const result = await ErrorHandler.withRetry(fn, {
        maxRetries: 3,
        retryDelay: 10,
      });
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('재시도 불가능한 에러는 즉시 throw', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('syntax error'));
      await expect(
        ErrorHandler.withRetry(fn, { maxRetries: 3, retryDelay: 10 })
      ).rejects.toThrow('syntax error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('ECONNRESET 코드를 재시도 가능으로 인식', async () => {
      const err = new Error('connection reset');
      (err as any).code = 'ECONNRESET';
      const fn = jest.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValue('ok');

      const result = await ErrorHandler.withRetry(fn, { maxRetries: 2, retryDelay: 10 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('최대 재시도 초과 시 마지막 에러 throw', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('network fail'));
      await expect(
        ErrorHandler.withRetry(fn, { maxRetries: 2, retryDelay: 10 })
      ).rejects.toThrow('network fail');
      expect(fn).toHaveBeenCalledTimes(3); // 초기 + 2회 재시도
    });
  });

  // ─── withTimeout ───────────────────────────────────

  describe('withTimeout', () => {
    it('시간 내 완료 시 결과 반환', async () => {
      const fn = () => Promise.resolve('fast');
      const result = await ErrorHandler.withTimeout(fn, 1000);
      expect(result).toBe('fast');
    });

    it('타임아웃 초과 시 에러', async () => {
      const fn = () => new Promise((resolve) => setTimeout(resolve, 5000));
      await expect(
        ErrorHandler.withTimeout(fn, 50)
      ).rejects.toThrow('50ms');
    });

    it('커스텀 타임아웃 메시지', async () => {
      const fn = () => new Promise((resolve) => setTimeout(resolve, 5000));
      await expect(
        ErrorHandler.withTimeout(fn, 50, 'API 시간 초과')
      ).rejects.toThrow('API 시간 초과');
    });
  });

  // ─── withFallback ──────────────────────────────────

  describe('withFallback', () => {
    it('주 함수 성공 시 주 함수 결과 반환', async () => {
      const result = await ErrorHandler.withFallback(
        () => Promise.resolve('primary'),
        () => Promise.resolve('fallback')
      );
      expect(result).toBe('primary');
    });

    it('주 함수 실패 시 폴백 결과 반환', async () => {
      const result = await ErrorHandler.withFallback(
        () => Promise.reject(new Error('fail')),
        () => Promise.resolve('fallback')
      );
      expect(result).toBe('fallback');
    });

    it('둘 다 실패 시 에러', async () => {
      await expect(
        ErrorHandler.withFallback(
          () => Promise.reject(new Error('primary fail')),
          () => Promise.reject(new Error('fallback fail'))
        )
      ).rejects.toThrow('주 함수와 폴백 모두 실패');
    });
  });

  // ─── safeJsonParse ─────────────────────────────────

  describe('safeJsonParse', () => {
    it('유효한 JSON 파싱', () => {
      expect(ErrorHandler.safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it('잘못된 JSON은 기본값 반환', () => {
      expect(ErrorHandler.safeJsonParse('invalid', { fallback: true })).toEqual({ fallback: true });
    });

    it('빈 문자열은 기본값 반환', () => {
      expect(ErrorHandler.safeJsonParse('', [])).toEqual([]);
    });
  });

  // ─── safeNumber ────────────────────────────────────

  describe('safeNumber', () => {
    it('숫자는 그대로 반환', () => {
      expect(ErrorHandler.safeNumber(42)).toBe(42);
    });

    it('문자열 숫자 변환', () => {
      expect(ErrorHandler.safeNumber('3.14')).toBe(3.14);
    });

    it('NaN은 기본값 반환', () => {
      expect(ErrorHandler.safeNumber('abc', 0)).toBe(0);
    });

    it('null/undefined는 기본값 반환', () => {
      expect(ErrorHandler.safeNumber(null, -1)).toBe(-1);
      expect(ErrorHandler.safeNumber(undefined, -1)).toBe(-1);
    });
  });

  // ─── safeString ────────────────────────────────────

  describe('safeString', () => {
    it('문자열은 그대로 반환', () => {
      expect(ErrorHandler.safeString('hello')).toBe('hello');
    });

    it('숫자를 문자열로 변환', () => {
      expect(ErrorHandler.safeString(123)).toBe('123');
    });

    it('null은 기본값 반환', () => {
      expect(ErrorHandler.safeString(null, 'default')).toBe('default');
    });
  });

  // ─── isNetworkError ────────────────────────────────

  describe('isNetworkError', () => {
    it('네트워크 관련 메시지 감지', () => {
      expect(ErrorHandler.isNetworkError(new Error('network error'))).toBe(true);
      expect(ErrorHandler.isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
      expect(ErrorHandler.isNetworkError(new Error('timeout'))).toBe(true);
    });

    it('에러 코드로 감지', () => {
      const err = new Error('');
      (err as any).code = 'ECONNRESET';
      expect(ErrorHandler.isNetworkError(err)).toBe(true);
    });

    it('일반 에러는 false', () => {
      expect(ErrorHandler.isNetworkError(new Error('validation failed'))).toBe(false);
    });
  });

  // ─── isApiError ────────────────────────────────────

  describe('isApiError', () => {
    it('400-599 상태 코드 감지', () => {
      expect(ErrorHandler.isApiError({ status: 401 })).toBe(true);
      expect(ErrorHandler.isApiError({ status: 500 })).toBe(true);
      expect(ErrorHandler.isApiError({ response: { status: 429 } })).toBe(true);
    });

    it('200대는 false', () => {
      expect(ErrorHandler.isApiError({ status: 200 })).toBe(false);
    });
  });

  // ─── getFriendlyMessage ────────────────────────────

  describe('getFriendlyMessage', () => {
    it('네트워크 에러 → 친절한 메시지', () => {
      const msg = ErrorHandler.getFriendlyMessage(new Error('network'), 'API');
      expect(msg).toContain('네트워크');
      expect(msg).toContain('API');
    });

    it('401/403 → 인증 오류 메시지', () => {
      const msg = ErrorHandler.getFriendlyMessage({ status: 401 });
      expect(msg).toContain('인증');
    });

    it('429 → 한도 초과 메시지', () => {
      const msg = ErrorHandler.getFriendlyMessage({ status: 429 });
      expect(msg).toContain('한도');
    });

    it('500+ → 서버 오류 메시지', () => {
      const msg = ErrorHandler.getFriendlyMessage({ status: 502 });
      expect(msg).toContain('서버');
    });
  });

  // ─── safeExecute ───────────────────────────────────

  describe('safeExecute', () => {
    it('성공 시 결과 반환', async () => {
      const result = await ErrorHandler.safeExecute(() => Promise.resolve(42), 0);
      expect(result).toBe(42);
    });

    it('실패 시 기본값 반환 (크래시 없음)', async () => {
      const result = await ErrorHandler.safeExecute(
        () => Promise.reject(new Error('boom')),
        'default'
      );
      expect(result).toBe('default');
    });
  });

  // ─── checkMemoryUsage ──────────────────────────────

  describe('checkMemoryUsage', () => {
    it('임계값 미만이면 false', () => {
      expect(ErrorHandler.checkMemoryUsage(99999)).toBe(false);
    });

    it('임계값 초과 시 true + 경고', () => {
      // 현재 힙은 최소 수 MB이므로 임계값을 0으로 설정
      expect(ErrorHandler.checkMemoryUsage(0)).toBe(true);
    });
  });
});
