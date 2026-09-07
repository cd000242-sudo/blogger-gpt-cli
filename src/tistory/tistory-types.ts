export type TistoryVisibility = 'public' | 'private' | 'protected';
export type TistoryPostingMode = 'publish' | 'draft' | 'schedule';

export type TistoryProfile = {
  id: string;
  blogName: string;
  blogUrl: string;
  profileDir: string;
  defaultCategory?: string;
  defaultVisibility: TistoryVisibility;
  lastLoginAt?: string;
  lastTestPublishUrl?: string;
};

export type TistoryCategory = {
  id?: string;
  name: string;
  label: string;
  source?: 'editor' | 'manage' | 'fallback';
};

export type TistoryCategoryLoadResult = {
  ok: boolean;
  authenticated: boolean;
  blogName?: string;
  blogUrl?: string;
  categories?: TistoryCategory[];
  selectedCategory?: string;
  error?: string;
};

export type TistoryConfig = {
  blogName: string;
  blogUrl: string;
  profileDir: string;
  defaultCategory?: string;
  visibility: TistoryVisibility;
  protectedPassword?: string;
  kakaoEmail?: string;
  browserExecutablePath?: string;
  hiddenBrowser?: boolean;
  keepBrowserOpen?: boolean;
  dryRun?: boolean;
  timeoutMs: number;
};

export type TistoryPublishInput = {
  payload: Record<string, any>;
  title: string;
  html: string;
  thumbnailUrl?: string;
  postingMode: TistoryPostingMode;
  scheduleDate?: Date | null;
  onLog?: (message: string) => void;
};

export type TistoryManualRecovery = {
  title: string;
  html: string;
  tags: string[];
  blogWriteUrl: string;
  reason: string;
};

export type TistoryPublishResult = {
  ok: boolean;
  url?: string;
  postId?: string;
  error?: string;
  needsAuth?: boolean;
  blockedReason?: string;
  recoverable?: boolean;
  skipped?: boolean;
  /**
   * 🏷️ v3.8.704 — 태그가 몇 개 들어갔는가.
   * 예전에는 태그를 못 넣으면 발행 전체를 실패시켰다(사장님: "발행 실패: Tistory tag input
   * was not found"). 이제 글은 나가고, 대신 **몇 개 중 몇 개가 들어갔는지** 알려 준다.
   */
  tagsRequested?: number;
  tagsAdded?: number;
  manualRecovery?: TistoryManualRecovery;
};

export type TistorySessionStatus = {
  ok: boolean;
  authenticated: boolean;
  blogName?: string;
  blogUrl?: string;
  writeUrl?: string;
  profileDir?: string;
  error?: string;
};
