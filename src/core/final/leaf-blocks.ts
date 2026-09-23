/**
 * leaf-blocks — 본문을 **문단(잎 블록)** 단위로 나눈다. (v3.8.750)
 *
 * 잎 블록 = 안에 다른 블록이 없는 p·li·td·div …. 위치(start·end)로 들고 다녀서, 바꿀 때 그 문단 안쪽만 갈아끼운다.
 *
 * 문장도 문단 안에서 나눠야 한다 — 5515 재생 실측: 마침표 없는 소제목 "재신청 시점과 신용점수 영향은 확인이 필요해요"와
 * 바로 아래 문단의 누출 문장이 평문에서 한 문장으로 붙어, 그 "문장"을 품은 문단이 없어 고칠 위치를 못 찾았다.
 */
import { stripToPlainText } from './substance-gate';

export interface LeafBlock {
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
  tag: string;
  /** 여는 태그 그대로 (class 등) */
  open: string;
  text: string;
}

const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'section', 'article', 'figure', 'figcaption', 'dl', 'dd', 'dt', 'pre', 'aside', 'nav', 'header', 'footer', 'details', 'summary', 'form']);
const LEAF_TAGS = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'figcaption', 'blockquote', 'div']);
const VOID_TAGS = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'param', 'track']);
const TAG_RE = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;

export function leafBlocks(html: string): LeafBlock[] {
  const src = String(html || '');
  const out: LeafBlock[] = [];
  let stack: Array<{ tag: string; start: number; openEnd: number; nested: boolean }> = [];
  for (const m of src.matchAll(TAG_RE)) {
    if (m[0].startsWith('<!--')) continue;
    const tag = String(m[2] || '').toLowerCase();
    const at = m.index ?? 0;
    if (m[1] !== '/') {
      if (VOID_TAGS.has(tag) || m[3] === '/') continue;
      // 블록이 열리면 감싸고 있는 것들은 모두 잎이 아니다
      if (BLOCK_TAGS.has(tag)) stack = stack.map((s) => ({ ...s, nested: true }));
      stack = [...stack, { tag, start: at, openEnd: at + m[0].length, nested: false }];
      continue;
    }
    // 닫는 태그 — 짝을 찾을 때까지 꺼낸다 (깨진 HTML 도 견딘다)
    const idx = stack.map((s) => s.tag).lastIndexOf(tag);
    if (idx < 0) continue;
    const open = stack[idx]!;
    stack = stack.slice(0, idx);
    if (!LEAF_TAGS.has(tag) || open.nested) continue;
    const text = stripToPlainText(src.slice(open.openEnd, at));
    if (text) {
      out.push({ start: open.start, openEnd: open.openEnd, closeStart: at, end: at + m[0].length, tag, open: src.slice(open.start, open.openEnd), text });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function sentencesOf(text: string): string[] {
  return String(text || '').split(/(?<=[.!?。])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** 문단 안에서 나눈 문장들 — 문단 경계를 넘는 "문장"이 생기지 않는다 */
export function blockSentences(html: string): string[] {
  return leafBlocks(html).flatMap((b) => sentencesOf(b.text));
}
