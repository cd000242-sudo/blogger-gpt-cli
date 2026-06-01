// src/core/external-traffic/_shared/types.js
// 외부유입 글 생성 — 공통 타입 정의 (JSDoc)
// v2.3 명세: paragraphRule, multi-output, riskScore, confidence 등 전체 인터페이스.

'use strict';

/**
 * @typedef {Object} Stage1Summary
 * 원본 글을 Stage 1에서 요약한 결과. 채널별 Stage 2 변환에 입력으로 사용.
 * @property {string} coreValue          핵심 가치 1~2문장
 * @property {string[]} hooks            후킹 카피 후보 5개
 * @property {string[]} keyPoints        본문 핵심 포인트 3~5개
 * @property {string[]} keywords         SEO 키워드 10개
 * @property {string[]} dataPoints       검증 가능한 수치/사례 5개
 * @property {'neutral'|'positive'|'urgent'|'analytical'} sentiment 어조
 */

/**
 * @typedef {Object} ToneSignature
 * @property {'casual'|'polite'|'mixed'} formality
 * @property {'minimal'|'medium'|'heavy'} emoji
 * @property {string[]} slang            특유 은어/줄임말
 * @property {string[]} pronouns         호칭
 */

/**
 * @typedef {Object} ParagraphRule
 * 채널별 출력 문단 정리 규칙.
 * @property {number|'no-limit'} maxLineChars      줄당 글자수
 * @property {'single'|'double'|'none'} paragraphBreak 문단 구분 (빈 줄 0/1/2개)
 * @property {number} [emptyLineMaxConsecutive]    연속 빈 줄 최대 (인스타 1)
 * @property {boolean} [emojiBetweenParagraphs]    분리 이모지 자동 삽입
 * @property {number} [maxLines]                    전체 줄 수 상한 (카톡 1~2)
 * @property {string[]} [splitOutput]               multi-output 영역
 * @property {boolean} [hashtagSeparated]           해시태그 별도 분리
 * @property {'end-of-body'|'separate-block'|'first-comment'|'natural-citation'|'none'} [ctaSection] CTA 위치
 * @property {'bold-line'|'h2-prefix'|'none'} [headingStyle]
 * @property {string} [photoPlaceholder]            '[사진 자리]'
 * @property {number} [photoBetweenParagraphs]      사진 자리 삽입 간격
 */

/**
 * @typedef {Object} TransformationAxes
 * @property {string} titleRule      제목 변환 규칙
 * @property {string} bodyRule       본문 변환 규칙
 * @property {'inline'|'comment'|'profile'|'natural-citation'|'none'} ctaPlacement
 * @property {string[]} linkBait     자연스러운 링크 미끼 문장
 */

/**
 * @typedef {Object} SubChannel
 * @property {string} id
 * @property {string} name
 * @property {string} rule
 */

/**
 * @typedef {Object} BandThresholds
 * 채널별 위험 등급 임계값.
 * @property {number} low
 * @property {number} medium
 * @property {number} high
 * @property {number} critical
 * @property {Object} [calibration]
 */

/**
 * @typedef {Object} RiskAxes
 * @property {number} bannedKeyword
 * @property {number} structure
 * @property {number} vocabulary
 * @property {number} ctaPattern
 * @property {number} toneMismatch
 * @property {number} selfPromotion
 */

/**
 * @typedef {Object} RiskAssessment
 * @property {number} score        0~100 (0=안전 추정, 100=거의 확실 ban)
 * @property {'low'|'medium'|'high'|'critical'} band
 * @property {RiskAxes} axes
 * @property {string[]} violations 감지된 금기 패턴
 * @property {string[]} warnings   약한 위험 시그널
 * @property {string} disclaimer
 */

/**
 * @typedef {Object} FormattedOutput
 * postFormat의 결과. multi-output 채널은 body 외 추가 영역.
 * @property {string} [body]
 * @property {string[]} [hashtags]
 * @property {string} [warning]              길이 초과 등 경고
 * @property {Object<string,string>} [parts] X tweet1/tweet2, 페북 personal/group-comment 등
 */

/**
 * @typedef {Object} BuildUserPromptParams
 * @property {Stage1Summary} sourceSummary
 * @property {string} sourceUrl
 * @property {string} sourceTitle
 * @property {string} [subChannel]
 * @property {string} [userCustomRule]
 */

/**
 * @typedef {Object} ChannelPrompt
 * 채널별 끝판왕 프롬프트 라이브러리 표준 인터페이스.
 * @property {string} id
 * @property {string} name
 * @property {'sns'|'community'|'naver'|'video'|'messenger'|'international'} category
 * @property {'low'|'medium'|'high'|'critical'|'out-of-scope'} riskTier
 * @property {'verified'|'inferred'|'user-curated'|'community-validated'} confidence
 * @property {string[]} killerHookPatterns
 * @property {string[]} bannedPhrases
 * @property {string[]} popularityTriggers
 * @property {ToneSignature} toneSignature
 * @property {TransformationAxes} transformationAxes
 * @property {ParagraphRule} paragraphRule
 * @property {BandThresholds} bandThresholds
 * @property {number} maxOutputTokens
 * @property {SubChannel[]} [subChannels]
 * @property {(subChannel?: string, userCustomRule?: string) => string} buildSystemPrompt
 * @property {(params: BuildUserPromptParams) => string} buildUserPrompt
 * @property {(response: string) => RiskAssessment} assessRisk
 * @property {string|null} userWarning
 * @property {string[]} operationalNotes
 * @property {string[]} researchSources
 * @property {string} lastVerified
 * @property {string} [openUrl]
 * @property {string} [icon]
 * @property {string} [color]
 */

module.exports = {};
