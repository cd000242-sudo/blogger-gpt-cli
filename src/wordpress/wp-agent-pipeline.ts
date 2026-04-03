/**
 * WordPress Agent Team Content Pipeline
 * 
 * 2-Step 에이전트 파이프라인:
 *   Step 1: 기존 buildContentPrompt() + anti-AI 규칙 → 초안 생성
 *   Step 2: 비평가+편집자 프롬프트(초안 + 품질 지표) → 최종 콘텐츠
 * 
 * 핵심 원칙:
 *   - 기존 prompt.ts 재활용 (새 프롬프트 안 만듦)
 *   - 코드는 "측정만", 수정은 LLM에게
 *   - Graceful Degradation (실패해도 초안 발행)
 */

import { buildContentPrompt, BuildPromptOptions } from '../core/prompt';

// ─── 타입 정의 ─────────────────────────────────────────────

export interface QualityMetrics {
    /** 문장 길이 표준편차 (목표: >4) */
    sentenceVariance: number;
    /** AI 전환어 출현 횟수 (목표: <5) */
    aiTellCount: number;
    /** 발견된 AI 전환어 목록 */
    aiTellWords: string[];
    /** 어휘 다양성 Type-Token Ratio (목표: >0.55) */
    typeTokenRatio: number;
    /** 평균 문장 길이 (어절 기준) */
    avgSentenceLength: number;
    /** 총 글자수 (HTML 태그 제외) */
    totalChars: number;
    /** 종합 점수 0~100 */
    score: number;
    /** 합격 여부 (score >= 60) */
    passOrFail: 'PASS' | 'FAIL';
}

export interface AgentPipelineResult {
    /** 최종 HTML 콘텐츠 */
    html: string;
    /** 최종 품질 지표 */
    metrics: QualityMetrics;
    /** Step 2에서 개선되었는지 */
    improved: boolean;
    /** 초안 품질 지표 (비교용) */
    draftMetrics: QualityMetrics;
    /** 사용된 단계 수 */
    stepsUsed: number;
}

// ─── AI 전환어 사전 ────────────────────────────────────────

const AI_TELL_WORDS: string[] = [
    '또한', '더불어', '아울러', '결론적으로', '요약하자면',
    '종합하면', '따라서', '그러므로', '이처럼', '이와 같이',
    '특히 주목할 점은', '흥미로운 점은', '중요한 것은',
    '주목해야 할 점은', '눈여겨볼 점은', '한편',
    '나아가', '뿐만 아니라', '이에 따라', '그 결과',
    '이를 통해', '이에 더해', '마찬가지로', '반면에',
    '이를 고려하면', '이를 바탕으로', '궁극적으로',
];

// ─── 품질 측정 (비파괴적) ──────────────────────────────────

/**
 * HTML 콘텐츠에서 순수 텍스트를 추출
 */
function stripHtmlTags(html: string): string {
    // <style> 태그 제거
    let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // 나머지 HTML 태그 제거
    text = text.replace(/<[^>]*>/g, '');
    // HTML 엔티티 변환
    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
    // 연속 공백 정리
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

/**
 * 텍스트를 문장 단위로 분리
 */
function splitSentences(text: string): string[] {
    // 한국어 문장 분리: 마침표, 물음표, 느낌표, ~요, ~다 등으로 분리
    const sentences = text.split(/(?<=[.!?。])\s+|(?<=다\.?\s)|(?<=요\.?\s)|(?<=죠\.?\s)|(?<=네\.?\s)/g)
        .map(s => s.trim())
        .filter(s => s.length > 2); // 너무 짧은 조각 제거
    return sentences;
}

/**
 * 문장 길이(어절 수)의 표준편차 계산
 */
function calcSentenceVariance(sentences: string[]): { variance: number; avg: number } {
    if (sentences.length < 2) return { variance: 0, avg: 0 };

    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const squaredDiffs = lengths.map(l => Math.pow(l - avg, 2));
    const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length);

    return { variance, avg };
}

/**
 * AI 전환어 출현 횟수 및 목록 반환
 */
function countAiTellWords(text: string): { count: number; found: string[] } {
    const found: string[] = [];
    let count = 0;

    for (const word of AI_TELL_WORDS) {
        const regex = new RegExp(word, 'g');
        const matches = text.match(regex);
        if (matches) {
            count += matches.length;
            found.push(`${word}(${matches.length}회)`);
        }
    }

    return { count, found };
}

/**
 * Type-Token Ratio (어휘 다양성) 계산
 */
function calcTypeTokenRatio(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;

    const uniqueWords = new Set(words);
    // 긴 텍스트에서 TTR이 자연히 낮아지는 것을 보정
    // 500어절 이상이면 √(unique) / √(total) 사용 (Root TTR)
    if (words.length > 500) {
        return Math.sqrt(uniqueWords.size) / Math.sqrt(words.length);
    }
    return uniqueWords.size / words.length;
}

/**
 * 비파괴적 품질 측정 — HTML을 수정하지 않고 지표만 계산
 */
export function measureQuality(html: string): QualityMetrics {
    const text = stripHtmlTags(html);
    const sentences = splitSentences(text);
    const { variance, avg } = calcSentenceVariance(sentences);
    const { count: aiTellCount, found: aiTellWords } = countAiTellWords(text);
    const ttr = calcTypeTokenRatio(text);
    const totalChars = text.replace(/\s/g, '').length;

    // 종합 점수 계산
    //   sentenceVariance: >4 → 30점, 2~4 → 15점, <2 → 5점
    //   aiTellCount: <5 → 30점, 5~10 → 15점, >10 → 5점
    //   TTR: >0.55 → 20점, 0.4~0.55 → 10점, <0.4 → 3점
    //   totalChars: 2000~5000 → 20점, 1000~2000 → 10점, <1000 → 5점
    let score = 0;
    score += variance > 4 ? 30 : variance > 2 ? 15 : 5;
    score += aiTellCount < 5 ? 30 : aiTellCount < 10 ? 15 : 5;
    score += ttr > 0.55 ? 20 : ttr > 0.4 ? 10 : 3;
    score += totalChars >= 2000 ? 20 : totalChars >= 1000 ? 10 : 5;

    return {
        sentenceVariance: Math.round(variance * 100) / 100,
        aiTellCount,
        aiTellWords,
        typeTokenRatio: Math.round(ttr * 1000) / 1000,
        avgSentenceLength: Math.round(avg * 10) / 10,
        totalChars,
        score,
        passOrFail: score >= 60 ? 'PASS' : 'FAIL',
    };
}

// ─── Anti-AI 규칙 (buildContentPrompt에 append) ────────────

/**
 * buildContentPrompt 결과 뒤에 추가할 anti-AI 규칙
 */
function buildAntiAIRules(): string {
    return `

[🛡️ AI 탐지 회피 필수 규칙 — 이 규칙은 위의 모든 규칙보다 우선합니다]

다음 규칙을 반드시 지켜주세요. 이 규칙을 어기면 콘텐츠가 거부됩니다.

1. **금지 전환어** (절대 사용 금지):
   "또한", "더불어", "아울러", "결론적으로", "요약하자면", "종합하면", 
   "이처럼", "이와 같이", "특히 주목할 점은", "흥미로운 점은", "중요한 것은",
   "나아가", "뿐만 아니라", "이에 따라", "그 결과", "이를 통해", "궁극적으로"
   → 대신 사용: "그리고", "근데", "암튼", "솔직히", "사실", "아 그리고", "참고로"

2. **문장 길이 변주** (필수):
   - 3~5어절 짧은 문장과 10~15어절 긴 문장을 번갈아 사용
   - 같은 길이의 문장이 3개 연속되면 안 됨
   - 예: "진짜 좋았다. (짧음) → 근데 처음에 이걸 시작했을 때는 솔직히 좀 막막했는데 알고 보니까 생각보다 간단한 구조더라고요. (긴 문장)"

3. **자기 수정 표현** (최소 2회):
   - "아, 이건 아니고...", "잠깐, 다시 생각해보니...", "아 아닌가, 좀 다른 얘긴데..."
   - 완성된 문장 후에 "근데 이건 좀 다른 관점에서 보면..." 식의 재고

4. **불완전한 문장** (최소 1회):
   - "이건 뭐... 각자 판단하실 부분이긴 한데"
   - "솔직히 이건 좀... 뭐라 해야 하나"

5. **구체적 숫자** (추상적 "많은", "다양한" 금지):
   - "37,500원이었는데" (O) vs "많은 비용이" (X)
   - "3일 걸렸는데" (O) vs "며칠 소요되며" (X)
   - "지난달 15일에" (O) vs "최근에" (X)

6. **감정적 반응** (자연스러운 감정 표현):
   - "이거 보고 진짜 놀랐음"
   - "솔직히 좀 짜증났는데"
   - "아 이건 진짜 괜찮다 싶었어요"

7. **절대 금지 패턴**:
   - "~에 대해 알아보겠습니다" → "~에 대해 얘기해볼게요"
   - "~를 살펴보겠습니다" → "~ 한번 볼까요"
   - "~하는 것이 좋습니다" → "~하는 게 나아요" 또는 "~하세요"
   - "~할 수 있습니다" → "~할 수 있어요" 또는 "~가 되더라고요"
   - "다양한 ~" → 구체적 나열로 대체
   - "중요한 것은" → "근데 핵심은" 또는 "사실 이게 제일 중요한데"
`.trim();
}

// ─── 비평가+편집자 프롬프트 ────────────────────────────────

/**
 * Step 2: 초안 + 품질 지표를 받아 비평+수정 지시 프롬프트 생성
 */
function buildCriticEditorPrompt(draftHtml: string, metrics: QualityMetrics): string {
    const aiWordsList = metrics.aiTellWords.length > 0
        ? metrics.aiTellWords.join(', ')
        : '(발견 안 됨)';

    return `
당신은 한국어 콘텐츠 전문 편집자이자 AI 탐지 전문가입니다.

아래 초안을 분석하고, AI가 쓴 느낌을 제거하여 자연스러운 인간의 글로 수정해주세요.

## 📊 현재 품질 분석 결과

| 지표 | 현재값 | 목표 | 상태 |
|------|--------|------|------|
| 문장 길이 변주 (표준편차) | ${metrics.sentenceVariance} | >4 | ${metrics.sentenceVariance > 4 ? '✅' : '⚠️ 개선 필요'} |
| AI 전환어 수 | ${metrics.aiTellCount}개 | <5 | ${metrics.aiTellCount < 5 ? '✅' : '⚠️ 개선 필요'} |
| 어휘 다양성 (TTR) | ${metrics.typeTokenRatio} | >0.55 | ${metrics.typeTokenRatio > 0.55 ? '✅' : '⚠️ 개선 필요'} |
| 평균 문장 길이 | ${metrics.avgSentenceLength}어절 | 5~10 | ${metrics.avgSentenceLength >= 5 && metrics.avgSentenceLength <= 10 ? '✅' : '⚠️ 조정 필요'} |
| 종합 점수 | ${metrics.score}/100 | 60+ | ${metrics.passOrFail} |

${metrics.aiTellWords.length > 0 ? `
## 🚨 발견된 AI 전환어 (반드시 교체)
${aiWordsList}

위 단어들은 AI가 자주 사용하는 전환어입니다. 
자연스러운 구어체 표현으로 교체하세요:
- "또한" → "그리고" 또는 "아 그리고"
- "따라서" → "그래서" 또는 생략
- "결론적으로" → "암튼" 또는 "정리하면"
- "이처럼" → 생략하거나 "이렇게"
- 기타 → 문맥에 맞는 구어체로 대체
` : ''}

${metrics.sentenceVariance <= 4 ? `
## 🔧 문장 길이 변주 부족
현재 문장들이 비슷한 길이입니다. 다음을 적용하세요:
- 3~5어절 짧은 문장을 중간중간 삽입: "진짜 좋다.", "이거 꿀팁이다.", "놀랐음."
- 긴 설명 문장(12어절+) 뒤에 짧은 감정 코멘트 추가
- 같은 길이 문장이 3개 연속되지 않게 조정
` : ''}

## 📝 수정 규칙

1. **콘텐츠의 핵심 정보와 구조는 유지** — 내용을 빼거나 추가하지 마세요
2. **HTML 태그와 클래스는 그대로 유지** — 스타일, 구조 건드리지 마세요
3. **수정은 오직 텍스트의 어투/표현만** — AI 느낌 → 인간 느낌으로
4. **자기 수정 표현 최소 2회 포함** — "아, 이건 좀 다른 얘긴데..."
5. **불완전한 문장 최소 1회** — "이건 뭐... 솔직히 좀 그렇긴 한데"
6. **감정적 반응 자연스럽게** — "이거 보고 진짜 좋았음"

## 🎯 출력

수정된 **최종 HTML만** 출력하세요.  
설명이나 비평 텍스트 없이, 순수 HTML만 반환하세요.

---

## 📄 초안 HTML

${draftHtml}
`.trim();
}

// ─── 메인 오케스트레이터 ───────────────────────────────────

/**
 * 에이전트 팀 파이프라인으로 콘텐츠 생성
 * 
 * @param topic - 주제
 * @param keywords - 키워드 (콤마 구분)
 * @param geminiKey - Gemini API 키
 * @param opts - 추가 옵션
 * @param onLog - 로그 콜백
 * @returns 최종 콘텐츠 + 품질 지표
 */
export async function generateWithAgentTeam(
    topic: string,
    keywords: string,
    geminiKey: string,
    opts?: {
        minChars?: number;
        toneStyle?: string;
        sectionCount?: number;
        model?: string;
    },
    onLog?: (msg: string) => void,
): Promise<AgentPipelineResult> {
    const log = (msg: string) => {
        console.log(`[AGENT-PIPELINE] ${msg}`);
        onLog?.(msg);
    };

    log('🤖 에이전트 팀 파이프라인 시작');

    // ─── Step 1: 작가 (기존 프롬프트 + anti-AI 규칙) ───────

    log('📝 Step 1: 작가 에이전트 - 초안 생성 중...');

    const promptOpts: BuildPromptOptions & { sectionCount?: number } = {
        topic,
        keywordsCSV: keywords,
        minChars: opts?.minChars ?? 3000,
        toneStyle: opts?.toneStyle ?? 'conversational',
        ...(opts?.sectionCount != null ? { sectionCount: opts.sectionCount } : {}),
    };

    // 기존 buildContentPrompt + anti-AI 규칙 append
    const step1Prompt = buildContentPrompt(promptOpts) + '\n\n' + buildAntiAIRules();

    let draftHtml: string;
    try {
        draftHtml = await callGemini(geminiKey, step1Prompt, opts?.model);
        log(`✅ Step 1 완료 - 초안 생성됨 (${draftHtml.length.toLocaleString()}자)`);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`❌ Step 1 실패: ${errMsg}`);
        throw new Error(`에이전트 파이프라인 Step 1 실패: ${errMsg}`);
    }

    // ─── 초안 품질 측정 ──────────────────────────────────────

    const draftMetrics = measureQuality(draftHtml);
    log(`📊 초안 품질: score=${draftMetrics.score}, AI전환어=${draftMetrics.aiTellCount}개, 문장변주=${draftMetrics.sentenceVariance}, TTR=${draftMetrics.typeTokenRatio}`);

    // 이미 고품질이면 Step 2 스킵
    if (draftMetrics.score >= 85) {
        log('🎯 초안이 이미 고품질 — Step 2 스킵');
        return {
            html: draftHtml,
            metrics: draftMetrics,
            improved: false,
            draftMetrics,
            stepsUsed: 1,
        };
    }

    // ─── Step 2: 비평가+편집자 ───────────────────────────────

    log('🔍 Step 2: 비평가+편집자 에이전트 - AI 탐지 회피 개선 중...');

    const step2Prompt = buildCriticEditorPrompt(draftHtml, draftMetrics);

    let finalHtml: string;
    try {
        finalHtml = await callGemini(geminiKey, step2Prompt, opts?.model);
        log(`✅ Step 2 완료 - 최종 콘텐츠 (${finalHtml.length.toLocaleString()}자)`);
    } catch (err) {
        // Graceful Degradation: Step 2 실패 시 초안 사용
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`⚠️ Step 2 실패 (초안 사용): ${errMsg}`);
        return {
            html: draftHtml,
            metrics: draftMetrics,
            improved: false,
            draftMetrics,
            stepsUsed: 1,
        };
    }

    // ─── 최종 품질 측정 ──────────────────────────────────────

    const finalMetrics = measureQuality(finalHtml);
    const improved = finalMetrics.score > draftMetrics.score;

    log(`📊 최종 품질: score=${finalMetrics.score} (${improved ? '↑' : '↓'} 초안 ${draftMetrics.score})`);
    log(`   AI전환어: ${draftMetrics.aiTellCount} → ${finalMetrics.aiTellCount}`);
    log(`   문장변주: ${draftMetrics.sentenceVariance} → ${finalMetrics.sentenceVariance}`);
    log(`   어휘다양성: ${draftMetrics.typeTokenRatio} → ${finalMetrics.typeTokenRatio}`);

    // 개선이 안 됐으면 초안 사용
    if (!improved) {
        log('⚠️ Step 2 결과가 초안보다 낫지 않음 — 초안 사용');
        return {
            html: draftHtml,
            metrics: draftMetrics,
            improved: false,
            draftMetrics,
            stepsUsed: 2,
        };
    }

    // ─── 품질 게이트 ─────────────────────────────────────────

    if (finalMetrics.passOrFail === 'FAIL') {
        log(`⚠️ 품질 게이트 FAIL (${finalMetrics.score}/100) — 그래도 개선되었으므로 최종 사용`);
    } else {
        log(`✅ 품질 게이트 PASS (${finalMetrics.score}/100)`);
    }

    return {
        html: finalHtml,
        metrics: finalMetrics,
        improved: true,
        draftMetrics,
        stepsUsed: 2,
    };
}

// ─── 마크다운 → HTML 변환 후처리 ────────────────────────────

/**
 * LLM이 HTML 프롬프트에도 마크다운을 섞어 출력하는 경우를 처리
 * 이미 HTML 태그가 있는 부분은 건드리지 않고, 마크다운만 변환
 */
function convertMarkdownToHtml(text: string): string {
    let result = text;

    // 1. 마크다운 코드블록 제거 (```html ... ```)
    result = result.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    // 중간에 있는 코드블록도 제거
    result = result.replace(/```html?\s*\n?/gi, '').replace(/\n?```/g, '');

    // 2. 마크다운 헤더 → HTML 헤더 (이미 <h2> 등이 있는 라인은 스킵)
    //    ### 헤더 → <h3>헤더</h3>  (h3 먼저 처리, h2보다 앞에)
    result = result.replace(/^#{3}\s+(.+)$/gm, (match, content) => {
        // 이미 HTML 태그가 포함되어 있으면 스킵
        if (/<\/?h\d/i.test(content)) return match;
        return `<h3>${content.trim()}</h3>`;
    });
    //    ## 헤더 → <h2>헤더</h2>
    result = result.replace(/^#{2}\s+(.+)$/gm, (match, content) => {
        if (/<\/?h\d/i.test(content)) return match;
        return `<h2>${content.trim()}</h2>`;
    });
    //    # 헤더 → <h2>헤더</h2>  (h1은 제목이므로 h2로 변환)
    result = result.replace(/^#{1}\s+(.+)$/gm, (match, content) => {
        if (/<\/?h\d/i.test(content)) return match;
        return `<h2>${content.trim()}</h2>`;
    });

    // 3. 마크다운 볼드 → <strong> (이미 HTML 태그 안에 있지 않은 경우만)
    //    **텍스트** → <strong>텍스트</strong>
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 4. 마크다운 이탤릭 → <em>
    //    *텍스트* → <em>텍스트</em>  (단, 이미 strong 처리된 건 스킵)
    result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // 5. 마크다운 리스트 → HTML 리스트
    //    연속된 "- 항목" 라인을 <ul><li> 로 변환
    result = result.replace(/(?:^[-*]\s+.+$\n?)+/gm, (match) => {
        const items = match
            .split('\n')
            .filter(line => line.trim())
            .map(line => `<li>${line.replace(/^[-*]\s+/, '').trim()}</li>`)
            .join('\n');
        return `<ul>\n${items}\n</ul>\n`;
    });

    // 6. 마크다운 번호 리스트 → HTML 순서 리스트
    result = result.replace(/(?:^\d+\.\s+.+$\n?)+/gm, (match) => {
        // <h2>, <h3> 태그가 포함된 라인이면 리스트 변환 스킵
        if (/<h[23]>/i.test(match)) return match;
        const items = match
            .split('\n')
            .filter(line => line.trim())
            .map(line => `<li>${line.replace(/^\d+\.\s+/, '').trim()}</li>`)
            .join('\n');
        return `<ol>\n${items}\n</ol>\n`;
    });

    // 7. 빈 줄로 구분된 텍스트 블록 → <p> 태그 (이미 HTML 태그가 없는 경우만)
    //    <style>, <div>, <section> 등 HTML 블록 사이의 순수 텍스트만 처리
    const lines: string[] = result.split('\n');
    const processedLines: string[] = [];
    let inHtmlBlock = false;

    for (const line of lines) {
        const trimmed: string = line.trim();

        // HTML 블록 태그 감지
        if (/<(?:style|div|section|table|ul|ol|h[1-6]|p|blockquote|nav|header|footer)/i.test(trimmed)) {
            inHtmlBlock = true;
        }
        if (/<\/(?:style|div|section|table|ul|ol|h[1-6]|p|blockquote|nav|header|footer)>/i.test(trimmed)) {
            processedLines.push(line);
            inHtmlBlock = false;
            continue;
        }

        // HTML 블록 안이면 그대로 유지
        if (inHtmlBlock) {
            processedLines.push(line);
            continue;
        }

        // 빈 줄이면 그대로
        if (!trimmed) {
            processedLines.push(line);
            continue;
        }

        // 이미 HTML 태그로 시작하면 그대로
        if (/^</.test(trimmed)) {
            processedLines.push(line);
            continue;
        }

        // 순수 텍스트 줄 → <p> 래핑
        processedLines.push(`<p>${trimmed}</p>`);
    }

    result = processedLines.join('\n');

    // 8. 연속된 빈 줄 정리
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
}

// ─── Gemini API 호출 헬퍼 ──────────────────────────────────

/**
 * Gemini API 호출 (기존 코드베이스 패턴 재사용)
 */
async function callGemini(apiKey: string, prompt: string, model?: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const geminiModel = genAI.getGenerativeModel({
        model: model || 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.9,       // 높은 온도로 더 창의적이고 다양한 표현
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 16384, // 긴 콘텐츠
        },
    });

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    // 마크다운 → HTML 변환 (LLM이 마크다운을 혼합 출력하는 경우 처리)
    text = convertMarkdownToHtml(text);

    if (!text || text.trim().length < 100) {
        throw new Error('생성된 콘텐츠가 너무 짧습니다');
    }

    return text.trim();
}
