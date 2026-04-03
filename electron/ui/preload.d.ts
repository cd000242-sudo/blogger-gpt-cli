// src/ui/preload.d.ts
export {};

declare global {
  type Provider = 'openai' | 'gemini';

  // 공통 실행 결과
  type IpcOk   = { ok: true;  logs?: string };
  type IpcFail = { ok: false; error?: string; exitCode?: number; logs?: string };
  type IpcResult = IpcOk | IpcFail;

  // ENV 구조
  interface BloggerEnv {
    provider: Provider;
    openaiKey?: string;
    geminiKey?: string;
    blogId: string;
    googleClientId: string;
    googleClientSecret: string;
    redirectUri: string;
    minChars?: number;
  }

  // 실행 페이로드
  interface RunPayload extends BloggerEnv {
    topic: string;
    keywords: string;
    publishType: 'draft' | 'now' | 'schedule';
    scheduleISO?: string;
    minChars: number;
  }

  // 엑셀 선택 결과
  // getEnv 결과 (저장된 값 없으면 data=null)
  type GetEnvResult =
    | { ok: true; data: (BloggerEnv & { minChars: number }) | null }
    | { ok: false; error?: string };

  interface Window {
    blogger: {
      /** 외부 링크 열기 */
      openLink(url: string): Promise<boolean>;

      /** .env 저장 */
      saveEnv(env: BloggerEnv): Promise<IpcResult>;

      /** .env 불러오기(앱 실행 시 폼 초기화) */
      getEnv(): Promise<GetEnvResult>;

      /** 단일 포스팅 실행 */
      runPost(payload: RunPayload): Promise<IpcResult>;

      /** 생성된 콘텐츠 발행 */
      publishContent(
        payload: any,
        title: string,
        content: string,
        thumbnailUrl: string
      ): Promise<{ ok: boolean; url?: string; id?: string; error?: string }>;

      /**
       * 실시간 로그 구독
       * 사용: const off = window.blogger.onLog(line => ...);  // off() 호출 시 해제
       */
      onLog(listener: (line: string) => void): () => void;

      /** 진행률 업데이트 구독 */
      onProgress(listener: (data: { p: number; label?: string }) => void): () => void;
    };

    externalLinksAPI?: {
      read(): Promise<any>;
      write(links: any[]): Promise<{ ok: boolean; error?: string }>;
    };
  }
}
