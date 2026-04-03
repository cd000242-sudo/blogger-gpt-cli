// global.d.ts (또는 renderer 전역 타입 선언 파일)
export { };

declare global {
  type Provider = 'openai' | 'gemini';
  type PublishType = 'draft' | 'now' | 'schedule';

  // 공통 실행 결과
  type IpcOk = { ok: true; logs?: string };
  type IpcFail = { ok: false; error?: string; exitCode?: number; logs?: string };
  type IpcResult = IpcOk | IpcFail;

  // ENV 구조 (preload에서 숫자 보정하므로 string 허용)
  interface BloggerEnv {
    provider: Provider;
    openaiKey?: string;
    geminiKey?: string;
    blogId: string;
    googleClientId: string;
    googleClientSecret: string;
    redirectUri: string;
    minChars?: number | string;
    deepInfraApiKey?: string; // 🔥 DeepInfra API 키
  }

  // 실행 페이로드
  interface RunPayload extends BloggerEnv {
    topic: string;
    /** 빈 문자열 허용 (주제만으로도 실행 가능) */
    keywords: string;
    publishType: PublishType;
    scheduleISO?: string;
    /** RunPayload에서는 최종적으로 숫자 형태 권장 */
    minChars: number;
  }

  // .env 로드 결과 (없으면 data=null)
  type GetEnvResult =
    | { ok: true; data: (Omit<BloggerEnv, 'minChars'> & { minChars?: number }) | null }
    | { ok: false; error?: string };

  interface Window {
    blogger: {
      /** 외부 링크 열기 */
      openLink(href: string): Promise<boolean>;

      /** .env 저장 (문자열/숫자 minChars 허용) */
      saveEnv(env: BloggerEnv): Promise<IpcResult>;

      /** .env 불러오기(앱 실행 시 폼 초기화) */
      getEnv(): Promise<GetEnvResult>;

      /** 단일 포스팅 실행 */
      runPost(payload: RunPayload): Promise<IpcResult>;

      /**
       * 실시간 로그 구독
       * const off = window.blogger.onLog(line => ...);
       * off() 호출 시 구독 해제
       */
      onLog(listener: (line: string) => void): () => void;

      /** 라이선스 관련 */
      getLicense(): Promise<{ ok: true; data: any } | { ok: false; error?: string }>;
      saveLicense(data: { maxUses: number; expiresAt: string; pin?: string }): Promise<{ ok: true; data: any } | { ok: false; error?: string }>;
      onLicense?(listener: (d: any) => void): () => void;
    };
  }
}
