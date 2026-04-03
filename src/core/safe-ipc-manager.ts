/**
 * 안전한 IPC 통신 관리자
 * UnhandledPromiseRejectionWarning 및 객체 복제 오류 해결
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { UnifiedEnvManager, UnifiedEnvConfig } from './unified-env-manager';

export class SafeIpcManager {
  private static instance: SafeIpcManager;
  private envManager: UnifiedEnvManager;
  
  private constructor() {
    this.envManager = UnifiedEnvManager.getInstance();
  }
  
  static getInstance(): SafeIpcManager {
    if (!SafeIpcManager.instance) {
      SafeIpcManager.instance = new SafeIpcManager();
    }
    return SafeIpcManager.instance;
  }
  
  /**
   * 안전한 IPC 핸들러 등록
   */
  setupHandlers(): void {
    console.log('[IPC] 안전한 IPC 핸들러 설정 시작');
    
    // 환경변수 로드 핸들러
    ipcMain.handle('load-environment-settings', this.safeHandler(async () => {
      try {
        const config = await this.envManager.loadConfig();
        return { ok: true, data: config };
      } catch (error) {
        console.error('[IPC] 환경변수 로드 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    
    // 환경변수 저장 핸들러 (검증 포함)
    ipcMain.handle('save-environment-settings', this.safeHandler(async (_event, settings: Partial<UnifiedEnvConfig>) => {
      try {
        const result = await this.envManager.saveConfig(settings);
        if (result.success) {
          return { ok: true };
        } else {
          return { 
            ok: false, 
            error: result.error || '설정 저장에 실패했습니다.',
            errors: result.errors
          };
        }
      } catch (error) {
        console.error('[IPC] 환경변수 저장 실패:', error);
        return { 
          ok: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }));
    
    // 키워드 설정 저장 핸들러 (LEWORD용, 검증 포함)
    ipcMain.handle('save-keyword-settings', this.safeHandler(async (_event, settings: Partial<UnifiedEnvConfig>) => {
      try {
        const result = await this.envManager.saveConfig(settings);
        if (result.success) {
          return { success: true };
        } else {
          return { 
            success: false, 
            error: result.error || '키워드 설정 저장에 실패했습니다.',
            errors: result.errors
          };
        }
      } catch (error) {
        console.error('[IPC] 키워드 설정 저장 실패:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }));
    
    // 네이버 세션 확인 핸들러
    ipcMain.handle('check-naver-session', this.safeHandler(async () => {
      try {
        const config = await this.envManager.loadConfig();
        
        if (!config.naverClientId || !config.naverClientSecret) {
          return {
            hasSession: false,
            isValid: false,
            error: '네이버 API 키가 설정되지 않았습니다'
          };
        }
        
        // 실제 세션 확인 로직은 여기에 구현
        // 현재는 API 키 존재 여부만 확인
        return {
          hasSession: true,
          isValid: true,
          username: '사용자'
        };
      } catch (error) {
        console.error('[IPC] 네이버 세션 확인 실패:', error);
        return {
          hasSession: false,
          isValid: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }));
    
    // 지식iN 크롤링 핸들러
    ipcMain.handle('crawl-kin', this.safeHandler(async (_event, options: any) => {
      try {
        // 실제 크롤링 로직은 여기에 구현
        // 현재는 시뮬레이션 데이터 반환
        const mockData = this.generateMockKinData(options);
        return mockData;
      } catch (error) {
        console.error('[IPC] 지식iN 크롤링 실패:', error);
        throw error;
      }
    }));
    
    // Excel 내보내기 핸들러
    ipcMain.handle('export-kin-excel', this.safeHandler(async (_event, _data: any[]) => {
      try {
        // 실제 Excel 내보내기 로직은 여기에 구현
        const filename = `kin_analysis_${Date.now()}.xlsx`;
        return filename;
      } catch (error) {
        console.error('[IPC] Excel 내보내기 실패:', error);
        throw error;
      }
    }));

    // 🔐 ImageFX Google 로그인 확인
    ipcMain.handle('imagefx:check-login', this.safeHandler(async () => {
      try {
        const { checkGoogleLoginForImageFx } = await import('./imageFxGenerator');
        return await checkGoogleLoginForImageFx();
      } catch (error) {
        console.error('[IPC] ImageFX 로그인 확인 실패:', error);
        return { loggedIn: false, message: error instanceof Error ? error.message : String(error) };
      }
    }));

    // 🔐 ImageFX Google 로그인 실행
    ipcMain.handle('imagefx:login', this.safeHandler(async () => {
      try {
        const { loginGoogleForImageFx } = await import('./imageFxGenerator');
        return await loginGoogleForImageFx();
      } catch (error) {
        console.error('[IPC] ImageFX 로그인 실패:', error);
        return { loggedIn: false, message: error instanceof Error ? error.message : String(error) };
      }
    }));
    
    console.log('[IPC] 안전한 IPC 핸들러 설정 완료');
  }
  
  /**
   * 안전한 핸들러 래퍼
   * Promise rejection 및 객체 복제 오류 방지
   */
  private safeHandler<T extends any[], R>(
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R>
  ) {
    return async (event: IpcMainInvokeEvent, ...args: T): Promise<R> => {
      try {
        // 메모리 사용량 체크
        if (typeof process !== 'undefined' && process.memoryUsage) {
          const usage = process.memoryUsage();
          const heapUsedMB = usage.heapUsed / 1024 / 1024;
          if (heapUsedMB > 500) {
            console.warn(`[IPC] 메모리 사용량 경고: ${heapUsedMB.toFixed(2)}MB`);
          }
        }
        
        // 입력 데이터 검증 및 정리
        const cleanArgs = this.sanitizeArgs(args) as T;
        
        // 핸들러 실행 (타임아웃 적용)
        const result = await this.executeWithTimeout(
          () => handler(event, ...(cleanArgs as T)),
          300000 // 5분 타임아웃
        );
        
        // 결과 데이터 검증 및 정리
        const cleanResult = this.sanitizeResult(result);
        
        return cleanResult;
      } catch (error) {
        console.error('[IPC] 핸들러 실행 오류:', error);
        
        // 에러 객체를 안전하게 변환
        const safeError = this.sanitizeError(error);
        throw safeError;
      }
    };
  }

  /**
   * 타임아웃이 있는 실행
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`작업이 ${timeoutMs}ms 내에 완료되지 않았습니다`));
        }, timeoutMs);
      })
    ]);
  }
  
  /**
   * 입력 인수 정리 및 검증
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return this.sanitizeString(arg);
      } else if (Array.isArray(arg)) {
        return arg.map(item => this.sanitizeArgs([item])[0]);
      } else if (arg && typeof arg === 'object') {
        return this.sanitizeObject(arg);
      }
      return arg;
    });
  }
  
  /**
   * 결과 데이터 정리 및 검증
   */
  private sanitizeResult(result: any): any {
    if (typeof result === 'string') {
      return this.sanitizeString(result);
    } else if (Array.isArray(result)) {
      return result.map(item => this.sanitizeResult(item));
    } else if (result && typeof result === 'object') {
      return this.sanitizeObject(result);
    }
    return result;
  }
  
  /**
   * 문자열 정리
   */
  private sanitizeString(str: string): string {
    return str
      .replace(/[\uD800-\uDFFF]/g, '') // 유효하지 않은 유니코드 서로게이트 쌍 제거
      .replace(/\0/g, '') // null 바이트 제거
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 제어 문자 제거
      .trim();
  }
  
  /**
   * 객체 정리 및 검증
   */
  private sanitizeObject(obj: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key === 'string' && key.length > 0) {
        const cleanKey = this.sanitizeString(key);
        if (cleanKey) {
          sanitized[cleanKey] = this.sanitizeResult(value);
        }
      }
    }
    
    return sanitized;
  }
  
  /**
   * 에러 객체 안전하게 변환
   */
  private sanitizeError(error: any): Error {
    if (error instanceof Error) {
      return new Error(this.sanitizeString(error.message));
    } else if (typeof error === 'string') {
      return new Error(this.sanitizeString(error));
    } else {
      return new Error('알 수 없는 오류가 발생했습니다');
    }
  }
  
  /**
   * 지식iN 시뮬레이션 데이터 생성
   */
  private generateMockKinData(options: any): any[] {
    const count = Math.min(options.maxResults || 10, 50);
    const categories = ['컴퓨터통신', '경제', '생활', '건강', '사회', '문화', '스포츠', '여행'];
    
    return Array.from({ length: count }, (_, index) => ({
      id: `kin_${Date.now()}_${index}`,
      title: `샘플 질문 ${index + 1}: ${options.keyword || '일반적인'} 관련 질문입니다`,
      url: `https://kin.naver.com/qna/detail.nhn?d1Id=1&dirId=1&docId=${Date.now() + index}`,
      views: Math.floor(Math.random() * 50000) + 1000,
      answers: Math.floor(Math.random() * 15) + 1,
      acceptedAnswer: Math.random() > 0.3,
      topAnswerLikes: Math.floor(Math.random() * 100) + 1,
      category: categories[Math.floor(Math.random() * categories.length)],
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * 핸들러 정리
   */
  cleanup(): void {
    console.log('[IPC] IPC 핸들러 정리');
    // 필요한 경우 핸들러 제거 로직 추가
  }
}
