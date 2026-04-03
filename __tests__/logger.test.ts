/**
 * Logger 유닛 테스트
 */
import { Logger, LogLevel, measurePerformance, measureAsyncPerformance } from '../src/utils/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(LogLevel.DEBUG);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 로그 레벨 필터링 ──────────────────────────────

  describe('로그 레벨 필터링', () => {
    it('ERROR 레벨에서는 error만 기록', () => {
      logger.setLogLevel(LogLevel.ERROR);
      logger.error('err');
      logger.warn('warn');
      logger.info('info');
      logger.debug('debug');

      const logs = logger.exportLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe(LogLevel.ERROR);
    });

    it('WARN 레벨에서는 error + warn 기록', () => {
      logger.setLogLevel(LogLevel.WARN);
      logger.error('err');
      logger.warn('warn');
      logger.info('info');

      const logs = logger.exportLogs();
      expect(logs).toHaveLength(2);
    });

    it('DEBUG 레벨에서는 모두 기록', () => {
      logger.error('err');
      logger.warn('warn');
      logger.info('info');
      logger.debug('debug');

      const logs = logger.exportLogs();
      expect(logs).toHaveLength(4);
    });
  });

  // ─── 로그 엔트리 구조 ──────────────────────────────

  describe('로그 엔트리', () => {
    it('timestamp, level, message 포함', () => {
      logger.info('test message', { key: 'value' });

      const logs = logger.exportLogs();
      expect(logs[0]!).toMatchObject({
        level: LogLevel.INFO,
        message: 'test message',
        context: { key: 'value' },
      });
      expect(logs[0]!.timestamp).toBeInstanceOf(Date);
    });

    it('context 없이도 동작', () => {
      logger.info('no context');
      const logs = logger.exportLogs();
      expect(logs[0]!.context).toBeUndefined();
    });
  });

  // ─── 로그 개수 제한 ────────────────────────────────

  describe('maxLogs 제한', () => {
    it('1000개 초과 시 오래된 로그 제거', () => {
      for (let i = 0; i < 1050; i++) {
        logger.info(`log ${i}`);
      }
      const logs = logger.exportLogs();
      expect(logs).toHaveLength(1000);
      expect(logs[0]!.message).toBe('log 50'); // 처음 50개 제거됨
    });
  });

  // ─── 성능 타이머 ───────────────────────────────────

  describe('성능 타이머', () => {
    it('startTimer → endTimer로 소요시간 측정', () => {
      logger.startTimer('test');
      const duration = logger.endTimer('test');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('시작하지 않은 타이머는 0 반환 + 경고', () => {
      const duration = logger.endTimer('nonexistent');
      expect(duration).toBe(0);
    });

    it('endTimer 후 타이머 제거', () => {
      logger.startTimer('once');
      logger.endTimer('once');
      const duration = logger.endTimer('once');
      expect(duration).toBe(0);
    });
  });

  // ─── clearLogs ─────────────────────────────────────

  describe('clearLogs', () => {
    it('로그와 타이머 모두 초기화', () => {
      logger.info('test');
      logger.startTimer('timer');
      logger.clearLogs();

      expect(logger.exportLogs()).toHaveLength(0);
      expect(logger.endTimer('timer')).toBe(0);
    });
  });

  // ─── getLogStats ───────────────────────────────────

  describe('getLogStats', () => {
    it('레벨별 통계 집계', () => {
      logger.error('e1');
      logger.error('e2');
      logger.warn('w1');
      logger.info('i1');
      logger.info('i2');
      logger.info('i3');
      logger.debug('d1');

      const stats = logger.getLogStats();
      expect(stats.total).toBe(7);
      expect(stats.byLevel['ERROR']).toBe(2);
      expect(stats.byLevel['WARN']).toBe(1);
      expect(stats.byLevel['INFO']).toBe(3);
      expect(stats.byLevel['DEBUG']).toBe(1);
    });

    it('빈 로그 통계', () => {
      const stats = logger.getLogStats();
      expect(stats.total).toBe(0);
    });
  });

  // ─── exportLogs 불변성 ─────────────────────────────

  describe('exportLogs', () => {
    it('원본 배열 복사본 반환', () => {
      logger.info('test');
      const exported = logger.exportLogs();
      exported.push({ timestamp: new Date(), level: LogLevel.ERROR, message: 'injected' });
      expect(logger.exportLogs()).toHaveLength(1);
    });
  });
});

// ─── measurePerformance ──────────────────────────────

describe('measurePerformance', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('동기 함수의 결과 반환', () => {
    const result = measurePerformance(() => 42, 'sync-test');
    expect(result).toBe(42);
  });

  it('동기 함수 에러 시 throw', () => {
    expect(() =>
      measurePerformance(() => { throw new Error('sync boom'); }, 'sync-err')
    ).toThrow('sync boom');
  });
});

describe('measureAsyncPerformance', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('비동기 함수의 결과 반환', async () => {
    const result = await measureAsyncPerformance(() => Promise.resolve('async'), 'async-test');
    expect(result).toBe('async');
  });

  it('비동기 함수 에러 시 throw', async () => {
    await expect(
      measureAsyncPerformance(() => Promise.reject(new Error('async boom')), 'async-err')
    ).rejects.toThrow('async boom');
  });
});
