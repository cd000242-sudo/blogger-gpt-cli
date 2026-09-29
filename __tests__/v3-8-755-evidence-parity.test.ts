const fs = require('fs');
const path = require('path');

import { extractNaverPostBody, DEFAULT_MAX_BODY_CHARS } from '../src/core/crawlers/naver-post-body';
import { toFinalCrawledPost, bridgeCrawledPost } from '../src/core/final/crawled-post-bridge';
import { judgeEvidence, assembleEvidence, renderEvidence, type EvidenceItem } from '../src/core/final/evidence';
import { buildValidationEvidence, describeValidationInput, VALIDATION_CONTEXT_MAX_CHARS } from '../src/core/final/validation-evidence';
import { inspectFactIntegrity, inspectArticleFactIntegrity, sanitizeArticleFactClaims, sanitizeFactUnsafeHtml, sanitizeFactUnsafeHeading, type FactEvidence } from '../src/core/final/fact-integrity';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FX = JSON.parse(read('__tests__/fixtures/run-f607bc/filter-inputs.json'));
const TODAY = '2026-09-29';
const BASE: FactEvidence = { context: '', provider: 'Naver Grounding', trustLevel: 'weak', topic: '청년미래적금 VS 청년 도약계좌' };
const plain = (o: any) => [String(o.introduction || ''), ...(o.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => String(h.content || '')))].join('\n');
const sentences = (t: string) => t.replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean);

/*
 * v3.8.755 — 실제 run f607bc(빌드 7919682) 로 확인한 연결 결함 둘.
 *   A. 크롤러 fullText 가 orchestration 매핑에서 떨어짐 → 블로그 3편이 1,223자 발췌 그대로
 *   B. 본문 사실 필터 문맥(발췌본)이 Writer 가 받은 근거 장부(보존 본문)와 달라 정상 조건을 지움(017→018)
 * 이 파일은 함수에 정답 문맥을 직접 넣지 않는다 — 추출기 → 매핑 → 초안 → 장부 → 렌더/검사 보기 순으로 실제 모듈을 지난다.
 */
describe('v3.8.755 A — fullText 가 매핑·장부까지 보존된다 (T1·T2·T10)', () => {
  const PROSE = (n: number) => Array.from({ length: n }, (_, i) => `청년 자산형성 상품의 기본 안내 ${i + 1}번째 문장은 가입 절차와 은행 창구 이용 방법을 설명합니다.`).join(' ');
  const LATE = '우대형은 총급여 3,600만 원 이하 또는 연매출 1억 원 이하인 소상공인이면서 기준 중위소득 150% 이하여야 합니다.';
  const html = `<html><body><div class="se-main-container"><p>${PROSE(40)} ${LATE}</p></div></body></html>`;

  test('T1 추출기 결과 → toFinalCrawledPost → bridgeCrawledPost → judgeEvidence 까지 fullText 가 살아 있다', () => {
    const body = extractNaverPostBody(html)!;
    expect(body.text.length).toBe(DEFAULT_MAX_BODY_CHARS);
    // 크롤러(content-crawler.crawlNaverPost)가 만드는 항목과 같은 꼴 — 매핑 함수는 이 꼴을 받는다
    const item = { title: '청년미래적금 우대형 조건 정리', url: 'https://m.blog.naver.com/x/1', content: body.text, subheadings: [], source: 'naver-blog', fullText: body.fullText, fullTextTruncatedAt: body.truncatedAt };
    const post = toFinalCrawledPost(item);
    expect(post.content).toBe(body.text);                                  // 발췌는 그대로
    expect(post.fullText).toContain(LATE);
    expect(post.fullTextTruncatedAt).toBeNull();
    const { draft, relevantContent } = bridgeCrawledPost(post, '청년미래적금');
    expect(draft.text).toContain(LATE);
    expect(draft.truncatedAt).toBeNull();
    expect(relevantContent.length).toBeLessThanOrEqual(body.text.length);  // relevantPosts 는 발췌 길이
    const v = judgeEvidence(draft, '청년미래적금');
    expect(v.item!.cleanedText).toContain(LATE);
    expect(v.item!.truncatedAt).toBeNull();
  });

  test('T2 발췌엔 없고 fullText 에만 있는 조건을 Writer 렌더와 검사 보기가 모두 대조한다', () => {
    const body = extractNaverPostBody(html)!;
    const post = toFinalCrawledPost({ title: '청년미래적금 우대형 조건 정리', url: 'https://m.blog.naver.com/x/1', content: body.text, source: 'naver-blog', fullText: body.fullText, fullTextTruncatedAt: body.truncatedAt });
    const items = assembleEvidence([{ ...judgeEvidence(bridgeCrawledPost(post, '청년미래적금').draft, '청년미래적금').item!, mainKeyword: '청년미래적금' }], TODAY);
    const render = renderEvidence(items, 11000);
    expect(render.text).toContain('연매출 1억 원 이하');
    const view = buildValidationEvidence(items, BASE);
    expect(view.basis).toBe('ledger');
    expect(view.complete).toBe(true);
    expect(view.docs[0]!.retained).toBe(true);
    expect(inspectFactIntegrity('<p>우대형은 연매출 1억 원 이하 소상공인이며 기준 중위소득 150% 이하여야 합니다.</p>', view.evidence).status).toBe('passed');
    // 같은 글을 옛 매핑(fullText 없음)으로 넣으면 검사 보기가 그 조건을 못 본다 — 이것이 f607bc 의 상태였다
    const legacyPost = toFinalCrawledPost({ title: post.title, url: post.url, content: body.text, source: 'naver-blog' });
    expect(legacyPost.fullText).toBeUndefined();
    const legacyItems = assembleEvidence([{ ...judgeEvidence(bridgeCrawledPost(legacyPost, '청년미래적금').draft, '청년미래적금').item!, mainKeyword: '청년미래적금' }], TODAY);
    expect(inspectFactIntegrity('<p>우대형은 연매출 1억 원 이하 소상공인이며 기준 중위소득 150% 이하여야 합니다.</p>', buildValidationEvidence(legacyItems, BASE).evidence).status).toBe('blocked');
  });

  test('T10 fullText 없는 legacy 입력은 오류 없이 처리하되 "전체 원문 대조" 로 표시하지 않는다', () => {
    const post = toFinalCrawledPost({ title: '옛 글', url: 'https://example.com/a', content: '청년미래적금은 3년 만기 적금이며 월 최대 50만 원까지 납입합니다. '.repeat(12), source: 'naver-blog' });
    const { draft } = bridgeCrawledPost(post, '청년미래적금');
    expect(draft.truncatedAt).toBeUndefined();
    const item = judgeEvidence(draft, '청년미래적금').item!;
    expect(item.truncatedAt).toBeUndefined();                              // null(안 잘림) 이 아니다
    const view = buildValidationEvidence(assembleEvidence([{ ...item, mainKeyword: '청년미래적금' }], TODAY), BASE);
    expect(view.docs[0]!.retained).toBe(false);
    expect(view.excerptOnlyIds).toEqual([view.docs[0]!.id]);
    const empty = buildValidationEvidence([], { ...BASE, context: '옛 발췌 문맥' });
    expect(empty.basis).toBe('legacy-excerpt');
    expect(empty.complete).toBe(false);
    expect(empty.evidence.context).toContain('옛 발췌 문맥');
  });
});

describe('v3.8.755 B — 검사기가 채택 근거 장부를 본다 (f607bc 저장 원고 · T3~T9·T11)', () => {
  const items: EvidenceItem[] = FX.stage2Items;
  const view = buildValidationEvidence(items, BASE, { deliveredIds: new Set(FX.renderUsedIds) });
  const draft = FX.draft017;

  test('T3 재구성한 발췌 문맥(OFFLINE_RECONSTRUCTION)은 018 과 같은 종류의 삭제를 낳고, 장부 보기는 정상 조건을 지원한다', () => {
    // 발췌본 재구성: grounding 항목 900자 · 크롤러 항목은 002 의 발췌 content. 당시 실제 필터 입력 자체는 저장되지 않았다
    const crawlerUrls = new Set(FX.searchDocuments.map((d: any) => d.url));
    const excerpt = [
      ...items.filter((i) => !crawlerUrls.has(i.url)).map((i) => `[${i.sourceType}] ${i.title} ${i.cleanedText.slice(0, 900)}`),
      ...FX.searchDocuments.map((d: any) => `${d.title} ${d.content}`),
    ].join('\n');
    const before = inspectArticleFactIntegrity(draft, { ...BASE, context: excerpt });
    expect(before.status).toBe('blocked');
    expect(before.violations.map((v: any) => v.detail).join(' | ')).toMatch(/150%/);           // 정상 조건이 "근거 없음" 으로 잡힌다
    const after = inspectArticleFactIntegrity(draft, view.evidence);
    expect(after.violations.map((v: any) => v.detail).join(' | ')).not.toMatch(/150%|1억원|3억원|3600만/);
    expect(after.violations.map((v: any) => v.detail).join(' | ')).toMatch(/10월9일/);          // 실제 오류는 그대로 잡힌다
  });

  test('T4 017 의 근거 있는 문장·표 값이 필터 뒤에도 남는다 — 각 값의 대상·조건이 근거 구간과 맞는다', () => {
    const cleaned = sanitizeArticleFactClaims(draft, view.evidence);
    const out = plain(cleaned);
    // 실제 018 에서 지워졌던 문장 — 근거: E26 "총급여 3600만 원(종합소득 2600만 원) 이하 중소기업 재직자 또는 연매출 1억 원 이하 소상공인이면서, 기준 중위소득 150% 이하"
    expect(out).toContain('총급여 3600만 원과 기준 중위소득 150% 이하 등 우대형 조건을 함께 충족해야 합니다');
    expect(out).toContain('연매출 3억 원 이하 조건과 가구 기준 중위소득 200% 이하');
    expect(out).toContain('연매출 1억 원 이하 소상공인, 기준 중위소득 150% 이하');                  // 2절 표의 우대형 칸
    expect(out).toContain('총급여 6000만 원 이하 또는 연매출 3억 원 이하 소상공인');               // 2절 표의 일반형 칸
    const ledger = items.map((i) => i.cleanedText).join('\n');
    expect(ledger).toMatch(/우대형[^.]{0,80}연매출 1억 원 이하[^.]{0,40}150%/);                      // 값의 대상(우대형)이 근거 구간과 같다
    expect(ledger).toMatch(/연 ?매출 3억 ?원 이하 소상공인/);
    // 실제 018 은 이 문장들을 지웠다 (ACTUAL_RUN)
    expect(plain(FX.draft018)).not.toContain('총급여 3600만 원과 기준 중위소득 150% 이하');
  });

  test('T5 근거 없는 날짜(10월 9일) 차단은 유지된다 — 날짜 자체를 금지하는 규칙이 아니라 근거 부재로', () => {
    const cleaned = sanitizeArticleFactClaims(draft, view.evidence);
    expect(plain(cleaned)).not.toContain('10월 9일부터 16일까지는');
    expect(plain(draft)).toContain('10월 9일부터 16일까지는');
    const ledger = items.map((i) => i.cleanedText).join('\n');
    expect(ledger).toContain('10월 12일부터 16일까지');                                           // 근거의 실제 일정
    expect(ledger).not.toMatch(/10월 ?9일/);
    // 다른 근거가 그 날짜를 뒷받침하면 통과한다
    const other = buildValidationEvidence([{ ...items[0]!, id: 'E99', cleanedText: `${items[0]!.cleanedText}\n금융위원회는 10월 9일부터 16일까지 출생연도와 관계없이 신청을 받는다.` }], BASE);
    expect(inspectFactIntegrity('<p>10월 9일부터 16일까지는 출생연도 끝자리와 관계없이 신청할 수 있습니다.</p>', other.evidence).status).toBe('passed');
  });

  test('T6 다른 유형·회차의 같은 숫자를 근거로 오인하지 않는다 (요약표 이름표 경로)', () => {
    expect(sanitizeFactUnsafeHtml('납입액의 12퍼센트', { ...view.evidence, subjectHint: '우대형 기여금' })).toBe('납입액의 12퍼센트');
    expect(sanitizeFactUnsafeHtml('납입액의 12퍼센트', { ...view.evidence, subjectHint: '일반형 기여금' })).toBe('');
    expect(sanitizeFactUnsafeHtml('납입액의 6퍼센트', { ...view.evidence, subjectHint: '일반형 기여금' })).toBe('납입액의 6퍼센트');
  });

  test('T7 본문에만 있고 장부에 없는 수치는 Writer 가 썼다는 이유로 통과하지 않는다', () => {
    expect(inspectFactIntegrity('<p>청년미래적금은 월 최대 90만원까지 납입할 수 있습니다.</p>', view.evidence).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>정부가 납입액의 37%를 지원합니다.</p>', view.evidence).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>청년미래적금은 월 최대 50만 원까지 납입할 수 있습니다.</p>', view.evidence).status).toBe('passed');
    // v3.8.756 — 단위를 띄어 쓴 "90만 원" 도 값 토큰으로 뽑혀 같은 대조를 지난다(예전엔 미추출로 통과했다)
    expect(inspectFactIntegrity('<p>청년미래적금은 월 최대 90만 원까지 납입할 수 있습니다.</p>', view.evidence).status).toBe('blocked');
  });

  test('T8 탈락 문서·검색 결과 전체는 검사 문맥에 들어가지 않는다', () => {
    expect(FX.stage2Rejected.length).toBeGreaterThan(0);
    const ledgerUrlSet = new Set(items.map((i) => i.url));
    // 같은 URL 이 한 채널에서 탈락하고 다른 채널에서 채택된 경우는 채택본이 장부에 있다 — 그 밖의 탈락 문서는 문맥에 없다
    const rejectedOnly = FX.stage2Rejected.filter((r: any) => !ledgerUrlSet.has(r.url));
    expect(rejectedOnly.length).toBeGreaterThan(0);
    const ledgerTitles = new Set(items.map((i) => i.title));
    for (const r of rejectedOnly) { expect(view.docs.some((d) => d.url === r.url)).toBe(false); if (r.title && !ledgerTitles.has(r.title)) expect(view.evidence.context).not.toContain(`] ${r.title}\n`); }
    expect(view.docs.map((d) => d.id).sort()).toEqual(items.map((i) => i.id).sort());   // 검사 문맥 = 채택 장부 그대로(검색 결과 전체가 아니다)
    expect(view.complete).toBe(true);
  });

  test('T9 부정·예정 문장을 확정 사실로 바꾸면 이름표 경로에서는 잡히고, 본문 경로의 한계는 그대로다', () => {
    const neg = buildValidationEvidence([{ ...items[0]!, id: 'E98', cleanedText: '이번 회차에는 우대형 12%가 적용되지 않는다. 우대형 15%는 예산안이 통과할 경우 적용될 예정이다.' }], BASE);
    expect(sanitizeFactUnsafeHtml('납입액의 12퍼센트', { ...neg.evidence, subjectHint: '우대형 기여금' })).toBe('');
    // 본문 문장의 "예정 → 확정" 전환은 현재 검사기가 가르지 않는다 — 통과한다는 사실을 기록한다(수정 대상 아님)
    expect(inspectFactIntegrity('<p>우대형 기여금은 15%가 적용됩니다.</p>', { ...neg.evidence, context: `${neg.evidence.context} ${'청년미래적금 안내문. '.repeat(20)}` }).status).toBe('passed');
  });

  test('T11 요약표 정리도 같은 장부 보기를 쓴다 — 본문에서 살린 값을 다시 지우지 않는다', () => {
    const rows = FX.summary019.rows.map((row: string[]) => row.map((v, ci) => (ci ? sanitizeFactUnsafeHtml(v, { ...view.evidence, subjectHint: String(row[0]) }) : v)));
    expect(rows).toEqual(FX.summary019.rows);
    expect(sanitizeFactUnsafeHeading(FX.title, view.evidence, '청년미래적금 VS 청년 도약계좌')).toBe(FX.title);
    const rec = describeValidationInput(view, { fn: 'sanitizeArticleFactClaims' });
    expect(rec.basis).toBe('ledger');
    expect(String(rec.contextSha1)).toMatch(/^[0-9a-f]{40}$/);
    expect((rec.docs as string[]).length).toBe(items.length);
  });

  test('T14 상한·예산 불변 — 검사 문맥이 커져도 Writer 근거 예산·요청 수와 무관하다', () => {
    expect(VALIDATION_CONTEXT_MAX_CHARS).toBe(200000);
    expect(view.contextChars).toBeGreaterThan(25000);
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toMatch(/renderEvidence\(evidenceItems, 11000[,)]/);   // 765: 예약·묶음 옵션이 붙어도 예산은 11000
    expect(read('src/core/final/naver-grounding.ts')).toContain('const BODY_FETCH_MAX = 6;');
    expect(read('src/core/crawlers/evidence-clean.ts')).toContain('export const RETAINED_TEXT_CHARS = 6000;');
  });
});

describe('v3.8.755 배선 — 실제 orchestration 경로가 새 경계를 지난다 (T15 red/green)', () => {
  const orch = read('src/core/final/orchestration.ts');

  test('크롤러 항목 매핑은 toFinalCrawledPost 를 지난다 (인라인 객체 리터럴 아님)', () => {
    expect(orch).toContain('crawledPosts.push(toFinalCrawledPost(item as any) as any)');
    expect(orch).not.toMatch(/crawledPosts\.push\(\{\s*title: item\.title \|\| ''/);
  });

  test('judgeCrawledPosts 는 bridgeCrawledPost 로 초안을 만든다', () => {
    const block = blockBetween(orch, 'const judgeCrawledPosts = (): void => {', 'judgeCrawledPosts();');
    expect(block).toContain('bridgeCrawledPost(post, keyword)');
    expect(block).toContain('relevantPosts.push({ ...post, content: bridged.relevantContent })');
  });

  test('본문 필터·제목·요약표·날조 검사가 같은 검사 보기(buildValidationEvidence)를 쓴다', () => {
    expect(orch).toContain("require('./validation-evidence')");
    expect(orch).toContain('const validationView = ()');
    expect(blockBetween(orch, '// A prompt is not enough', 'if (!payload.useKeywordAsTitle)')).toContain('sanitizeArticleFactClaims(allSectionsObj, bodyValidation.evidence)');
    expect(orch).toContain('sanitizeFactUnsafeHeading(h1, validationView().evidence, keyword)');
    expect(orch).toContain('checkFabrication(validationView().evidence.context');
    const table = blockBetween(orch, '// 6. 요약표', '// 7. 해시태그');
    expect(table).toContain('const tableValidation = validationView()');
    expect(table).toContain("{ ...tableValidation.evidence, subjectHint: String(row[0] || '') }");
    expect(table).not.toContain('sanitizeFactUnsafeHtml(value, factEvidence)');
    // 프롬프트용 문맥은 그대로 — 검증 보기로 바꾸지 않는다
    expect(orch).toContain('buildRepeatedFactsBlock([factEvidence.context, naverGrounding]');
    expect(orch).toContain('buildFactIntegrityPrompt(keyword, factEvidence)');
  });

  test('실제 필터 입력이 trace 에 남는다 (호출 직전 값)', () => {
    expect(orch).toContain("trace.event('fact-filter.input'");
    expect(orch).toContain("trace.event('summary-table.fact-filter.input'");
    expect(orch).toContain('describeValidationInput(bodyValidation');
  });
});
