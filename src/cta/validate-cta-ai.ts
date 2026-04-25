/**
 * 🤖 CTA URL AI 검증 (Perplexity)
 *
 * 일반 HTTP 검증(validate-cta-url.ts)이 잡지 못하는 두 가지 케이스에 사용:
 *  1) 200 OK이지만 본문이 의심스러운 정부/공공 사이트 (.go.kr/.or.kr 모호 케이스)
 *  2) 죽지 않았지만 키워드/주제와 의미적으로 안 맞는 URL (LLM의 진짜 가치)
 *
 * 비용/속도 보호:
 *  - 모듈 스코프 캐시 (Map<key, Promise<result>>) + TTL 30분
 *  - HTTP 검증이 fail/skip이면 호출하지 않음 (호출자 책임)
 *  - Perplexity API 키 없으면 즉시 ok 처리(통과시킴) — 부재가 차단 사유가 되면 안 됨
 */

import { callPerplexityAPI, getPerplexityApiKey } from '../core/llm';

export interface AiCtaResult {
    ok: boolean;
    confidence: number; // 0~1
    reason: string;
    elapsedMs: number;
    cached?: boolean;
    skipped?: boolean;
}

const AI_CACHE = new Map<string, { result: Promise<AiCtaResult>; expireAt: number }>();
const TTL_MS = 30 * 60 * 1000;

function cacheKey(url: string, keyword: string): string {
    return `${url.trim().toLowerCase()}|${(keyword || '').trim().toLowerCase()}`;
}

/**
 * URL이 키워드와 의미적으로 적합하고 실제 작동 페이지인지 Perplexity로 판단.
 * @param url 검증할 CTA URL
 * @param keyword 글의 메인 키워드 (의미 적합성 판단 기준)
 * @param options.strict 엄격 모드 — true면 confidence < 0.7 일 때 fail, false면 < 0.4 일 때만 fail
 */
export async function validateCtaUrlWithAi(
    url: string,
    keyword: string,
    options: { strict?: boolean; timeoutMs?: number } = {},
): Promise<AiCtaResult> {
    const start = Date.now();
    const { strict = false, timeoutMs = 12000 } = options;

    // 1) Perplexity 키 부재 시 — 통과 처리 (검증 시스템이 차단 사유가 되면 안 됨)
    const apiKey = getPerplexityApiKey();
    if (!apiKey || apiKey.length < 10) {
        return {
            ok: true,
            confidence: 1,
            reason: 'Perplexity API 키 미설정 — AI 검증 건너뜀',
            elapsedMs: Date.now() - start,
            skipped: true,
        };
    }

    // 2) 캐시 hit
    const key = cacheKey(url, keyword);
    const now = Date.now();
    const cached = AI_CACHE.get(key);
    if (cached && cached.expireAt > now) {
        const r = await cached.result;
        return { ...r, cached: true };
    }

    // 만료된 엔트리 정리
    if (AI_CACHE.size > 200) {
        for (const [k, v] of AI_CACHE.entries()) {
            if (v.expireAt <= now) AI_CACHE.delete(k);
        }
    }

    const promise = performAiValidation(url, keyword, strict, timeoutMs, start);
    AI_CACHE.set(key, { result: promise, expireAt: now + TTL_MS });
    return promise;
}

async function performAiValidation(
    url: string,
    keyword: string,
    strict: boolean,
    timeoutMs: number,
    start: number,
): Promise<AiCtaResult> {
    const prompt = `당신은 한국 블로그 CTA 링크 검증 전문가입니다. 아래 URL이 주어진 키워드와 관련된 정상적인 페이지인지 판단해 주세요.

키워드: "${keyword}"
URL: ${url}

판단 기준:
1) URL이 실제 접근 가능하고 에러/세션 만료 페이지가 아닌가?
2) 페이지 내용이 키워드와 의미적으로 적합한가? (예: "복지 지원금" 키워드에 등산 사이트가 있으면 부적합)
3) 한국 사용자에게 유용한 공식/신뢰 페이지인가?

다음 JSON 형식으로만 답변(다른 텍스트 금지):
{"ok": true|false, "confidence": 0.0~1.0, "reason": "한 줄 사유"}`;

    try {
        const raceResult = await Promise.race([
            callPerplexityAPI(prompt),
            new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('Perplexity 시간 초과')), timeoutMs),
            ),
        ]);
        const text = String(raceResult || '');

        // JSON 추출 (```json ... ``` 코드 펜스도 허용)
        const jsonMatch = text.match(/\{[\s\S]*?"ok"[\s\S]*?\}/);
        if (!jsonMatch) {
            // 파싱 실패 시 통과 처리(차단 사유 X)
            return {
                ok: true,
                confidence: 0.5,
                reason: 'AI 응답 파싱 실패 — 통과 처리',
                elapsedMs: Date.now() - start,
            };
        }
        let parsed: any;
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch {
            return {
                ok: true,
                confidence: 0.5,
                reason: 'AI 응답 JSON 파싱 오류 — 통과 처리',
                elapsedMs: Date.now() - start,
            };
        }

        const aiOk = parsed.ok === true;
        const aiConf = Number(parsed.confidence);
        const conf = Number.isFinite(aiConf) ? Math.max(0, Math.min(1, aiConf)) : 0.5;
        const reason = String(parsed.reason || '').slice(0, 200) || '사유 미제공';

        // 임계값 분기 — strict 모드는 confidence 0.7 미만이면 fail, 일반은 0.4 미만이면 fail
        const threshold = strict ? 0.7 : 0.4;
        const finalOk = aiOk && conf >= threshold;

        return {
            ok: finalOk,
            confidence: conf,
            reason: finalOk
                ? `AI 검증 통과 (${reason})`
                : `AI 검증 실패: ${reason}`,
            elapsedMs: Date.now() - start,
        };
    } catch (e: any) {
        // Perplexity 호출 실패 — 차단 사유로 삼지 않고 통과 처리
        return {
            ok: true,
            confidence: 0.3,
            reason: `Perplexity 호출 실패 (${e?.message || e}) — 통과 처리`,
            elapsedMs: Date.now() - start,
            skipped: true,
        };
    }
}
