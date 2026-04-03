// src/core/max-mode/types-interfaces.ts
// MAX 모드 타입/인터페이스 정의

export interface MaxModeSection {
  id: string;
  title: string;
  description: string;
  minChars: number;
  role: string;
  contentFocus: string;
  requiredElements: string[];
  crawledData?: {
    totalContents?: number;
    keywords?: string[];
    mainTopics?: string[];
    sentiment?: string;
    summary?: string;
    contents?: Array<{
      type?: string;
      title: string;
      content: string;
      url: string;
    }>;
  };
}

export interface ContentModeConfig {
  name: string;
  description: string;
  titleStrategy: string;
  sectionStrategy: string;
  tone: string;
  ctaStrategy: string;
}
