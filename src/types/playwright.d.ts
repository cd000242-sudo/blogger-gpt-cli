declare module 'playwright' {
  export interface Browser {
    newContext(options?: any): Promise<BrowserContext>;
    close(): Promise<void>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    addCookies(cookies: any[]): Promise<void>;
    close(): Promise<void>;
  }

  export interface Request {
    resourceType(): string;
  }

  export interface Route {
    request(): Request;
    abort(): Promise<void>;
    continue(): Promise<void>;
  }

  export interface Response {
    url(): string;
    request(): Request;
    status(): number;
  }

  export interface Page {
    setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
    route(pattern: string, handler: (route: Route) => Promise<void>): Promise<void>;
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
    content(): Promise<string>;
    on(event: 'response', handler: (response: Response) => void): void;
    evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  }

  export const chromium: {
    launch(options?: { headless?: boolean }): Promise<Browser>;
  };
}













