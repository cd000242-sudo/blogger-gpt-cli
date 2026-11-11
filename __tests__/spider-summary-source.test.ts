/**
 * 거미줄 종합글 — Agent 모드 요약(excerpt)·메타 설명이 "💡 한눈에 답변" 같은 상자 제목으로 시작하지 않는다
 *
 * 실측: 본문 앞 155자를 그대로 잘라 "💡 한눈에 답변 인천 산후조리원 …" 이 요약·메타가 됐다.
 * 새 규칙: 본문 맨 앞의 상자 제목·라벨 블록("💡 한눈에 답변", "Last updated: …", 이모지로 시작하는 12자 이하 줄)을
 * 건너뛰고 첫 실제 문장부터 자른다. 라벨이 없는 글은 예전과 글자 그대로 같다. 길이 규칙(152자+…)은 그대로.
 * 실측 파일은 읽지 않고 같은 모양의 작은 입력을 쓴다. 실제 LLM·앱·네트워크는 부르지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { blockBetween } from './helpers/source-block';
import { spiderSummarySource, fallbackSpiderMetaDescription, fallbackSpiderExcerpt } from '../src/core/spider';

const ANSWER = "인천 산후조리원 지원금은 인천광역시의 취약계층용 '맘편한 산후조리비'와 군·구 보건소의 자체 산후조리비로 나뉘는 지역 출산 지원 제도로, 시 사업은 11개 취약계층 유형 산모에게 150만원을 인천e음 포인트로, 구 사업은 거주기간을 채운 산모에게 50만~100만원을 지급합니다.";
const LEAD_P = '조리원 계약서를 받아 들면 2주 이용료 옆에 지원금부터 빼서 적어 보게 됩니다. 그런데 인천에서는 그 숫자가 150만원일 수도 있습니다.';
const BOX = `<div class="tldr-answer-box" style="padding:20px 24px;background:linear-gradient(135deg,#f2faf6,#e6f3ee);">
  <p style="margin:0 0 8px;color:#78350f;font-size:13px;font-weight:800;">💡 한눈에 답변</p>
  <p style="margin:0 0 14px;color:#1f2933;font-weight:700;">${ANSWER}</p>
  <ul><li><strong>시 지원금:</strong> 취약계층 산모 1인당 150만원</li></ul>
</div>`;
const UPDATED = '<div style="display:inline-flex;"><span>🕒</span> Last updated: 2026-11-11</div>';
const STYLE = '<style>.max-mode-article h2{color:#123456 !important;}</style>';

// The exact plain-text conversion the handler used before (main.ts) — the baseline for "unchanged" posts.
const oldPlain = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();
const oldExcerpt = (plain: string) => {
  const sentences = plain.split(/(?<=[.。!?])\s+/);
  let excerpt = sentences.slice(0, 2).join(' ').substring(0, 200).trim();
  if (excerpt.length < 50 && plain.length > 50) excerpt = plain.substring(0, 200).trim();
  return excerpt;
};

const SPIDER = `${STYLE}<div class="sw-cornerstone max-mode-article">${BOX}${UPDATED}<p>${LEAD_P}</p><h2>첫째 소제목</h2><p>본문입니다.</p></div>`;

describe('재현 — 예전 방식은 상자 제목으로 시작한다', () => {
  it('본문 앞을 그대로 자르면 "💡 한눈에 답변" 으로 시작한다', () => {
    expect(fallbackSpiderMetaDescription(oldPlain(SPIDER)).startsWith('💡 한눈에 답변')).toBe(true);
  });
});

describe('spiderSummarySource — 상자 제목·라벨을 건너뛴다', () => {
  it('요약 상자 제목 "💡 한눈에 답변" 다음의 첫 실제 문장부터 시작한다', () => {
    const src = spiderSummarySource(SPIDER);
    expect(src.startsWith('인천 산후조리원 지원금은')).toBe(true);
    expect(src).not.toMatch(/^💡/);
  });
  it('메타 설명 폴백과 요약(excerpt)이 모두 "인천 산후조리원 지원금은 …" 으로 시작하고 길이 규칙은 그대로다', () => {
    const src = spiderSummarySource(SPIDER);
    const meta = fallbackSpiderMetaDescription(src);
    expect(meta.startsWith('인천 산후조리원 지원금은')).toBe(true);
    expect(meta.endsWith('…')).toBe(true);
    expect(meta.length).toBe(153);
    const excerpt = fallbackSpiderExcerpt(src);
    expect(excerpt.startsWith('인천 산후조리원 지원금은')).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(200);
  });
  it('라벨이 여러 줄이어도(💡 라벨 + 🕒 Last updated) 모두 건너뛴다', () => {
    const html = `<p>💡 한눈에 답변</p>${UPDATED}<p>${ANSWER}</p>`;
    expect(spiderSummarySource(html).startsWith('인천 산후조리원 지원금은')).toBe(true);
  });
  it('"Last updated: …" 와 "📌 …" 처럼 이모지로 시작하는 12자 이하 줄도 라벨이다', () => {
    expect(spiderSummarySource(`<div>Last updated: 2026-11-11</div><p>${ANSWER}</p>`).startsWith('인천 산후조리원')).toBe(true);
    expect(spiderSummarySource(`<div>📌 핵심 정리</div><p>${ANSWER}</p>`).startsWith('인천 산후조리원')).toBe(true);
    expect(spiderSummarySource(`<div>💡<br>${ANSWER}</div>`).startsWith('인천 산후조리원')).toBe(true);
  });
  it('라벨과 답이 한 문단에 붙어 있어도 라벨 머리말만 뗀다', () => {
    expect(spiderSummarySource(`<p>💡 한눈에 답변 ${ANSWER}</p>`).startsWith('인천 산후조리원 지원금은')).toBe(true);
    expect(spiderSummarySource(`<p>한눈에 답변: ${ANSWER}</p>`).startsWith('인천 산후조리원 지원금은')).toBe(true);
  });
});

describe('spiderSummarySource — 머리말이 없는 글은 예전과 글자 그대로 같다', () => {
  it('첫 문단으로 시작하는 글', () => {
    const html = `<div class="sw-cornerstone"><p>${LEAD_P}</p><h2>첫째</h2><p>본문.</p></div>`;
    expect(spiderSummarySource(html)).toBe(oldPlain(html));
  });
  it('긴 소제목(13자 이상)으로 시작하는 글은 소제목을 라벨로 보지 않는다', () => {
    const html = `<h2>인천 산후조리원 지원금 총정리 가이드</h2><p>${LEAD_P}</p>`;
    expect(spiderSummarySource(html)).toBe(oldPlain(html));
  });
  it('이모지가 없는 평범한 짧은 줄과 따옴표로 시작하는 글도 그대로다', () => {
    const quoted = `<p>"산후조리비는 얼마나 받나요" 라는 질문을 자주 받습니다. ${LEAD_P}</p>`;
    expect(spiderSummarySource(quoted)).toBe(oldPlain(quoted));
    const shortLine = `<p>시작합니다</p><p>${LEAD_P}</p>`;
    expect(spiderSummarySource(shortLine)).toBe(oldPlain(shortLine));
  });
  it('요약 2026년 같은 일반 문장 머리는 라벨로 떼지 않는다', () => {
    const html = `<p>핵심 요약 방법은 세 가지입니다. ${LEAD_P}</p>`;
    expect(spiderSummarySource(html)).toBe(oldPlain(html));
  });
  it('excerpt 는 예전 규칙(첫 두 문장, 200자 이내)과 같다', () => {
    const plain = oldPlain(`<p>${LEAD_P}</p><p>두 번째 문단. 세 번째 문장입니다.</p>`);
    expect(fallbackSpiderExcerpt(plain)).toBe(oldExcerpt(plain));
    expect(fallbackSpiderExcerpt('짧다')).toBe(oldExcerpt('짧다'));
  });
  it('전부 라벨뿐이면 비우지 않고 예전 결과를 돌려준다', () => {
    const html = '<p>💡 한눈에 답변</p><div>Last updated: 2026-11-11</div>';
    expect(spiderSummarySource(html)).toBe(oldPlain(html));
    expect(spiderSummarySource('')).toBe('');
  });
});

describe('핸들러 배선 — 요약·메타는 라벨을 건너뛴 본문에서 만든다', () => {
  const MAIN = fs.readFileSync(path.join(process.cwd(), 'electron/main.ts'), 'utf8');
  const HANDLER = blockBetween(MAIN, "ipcMain.handle('generate-internal-consistency', async", "ipcMain.handle('save-image-as-png'");
  it('excerpt 와 두 군데의 메타 폴백이 spiderSummarySource 결과를 쓴다', () => {
    expect(HANDLER).toMatch(/spider\.spiderSummarySource\(generatedContent\)/);
    expect(HANDLER).toMatch(/spider\.fallbackSpiderExcerpt\(summaryText\)/);
    expect((HANDLER.match(/spider\.fallbackSpiderMetaDescription\(summaryText\)/g) || []).length).toBe(2);
    expect(HANDLER).not.toMatch(/fallbackSpiderMetaDescription\(plainText\)/);
  });
});
