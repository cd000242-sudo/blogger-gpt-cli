/**
 * 같은 어미를 글 전체에서 두 번까지만 (v3.8.750)
 *
 * v3.8.720 의 목적은 "문장 끝이 전부 같으면 기계가 읽어주는 소리가 난다"였다. 그런데 말투 섞기가
 * 문단마다 두 개라는 상한만 있고 **글 전체 상한이 없어서**, 판단 + 이유(…맞습니다. …때문입니다.)로
 * 끝나는 문단이 많은 글에서 같은 꼬리가 줄줄이 붙었다.
 *   라이브 URL 글(실손보험 청구, 2026-09-23): "때문이거든요." 7번 — 문단 끝마다 같은 소리.
 * 같은 규칙에서 나온 같은 꼬리는 글 전체에서 두 번까지만 쓴다. 나머지는 원문(합니다체) 그대로 둔다.
 */
import { softenHtmlVoice, softenSentence } from '../src/core/final/voice-softener';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('같은 꼬리 반복 상한 — 글 전체', () => {
  it('⭐⭐ "때문이거든요." 는 글 전체에서 두 번까지만 (나머지는 "때문입니다." 그대로)', () => {
    const html = [1, 2, 3, 4, 5, 6, 7]
      .map((i) => `<p>${i}번 경우에는 먼저 확인하는 편이 맞습니다. 조건이 사람마다 다르기 때문입니다.</p>`)
      .join('\n');
    const out = softenHtmlVoice(html);
    expect(count(out.html, '때문이거든요.')).toBe(2);
    expect(count(out.html, '때문입니다.')).toBe(5);
    expect(out.changed).toBe(2);
  });

  it('⭐⭐ 꼬리마다 따로 센다 — 거든요 두 번 · 있죠 두 번', () => {
    const html = [1, 2, 3]
      .map((i) => `<p>${i}번 항목은 따로 봅니다. 서류가 다르기 때문입니다. 창구도 따로 있습니다.</p>`)
      .join('\n');
    const out = softenHtmlVoice(html);
    expect(count(out.html, '때문이거든요.')).toBe(2);
    expect(count(out.html, '있죠.')).toBe(2);
    expect(count(out.html, '따로 있습니다.')).toBe(1);
  });

  it('⭐ 「…됩니다」처럼 앞 글자가 바뀌는 꼬리도 한 꼬리로 센다 (포함되죠·연결되죠 …)', () => {
    const html = ['포함', '연결', '전송', '처리']
      .map((w) => `<p>서류는 병원에서 보냅니다. 영수증도 여기에 ${w}됩니다.</p>`)
      .join('\n');
    const out = softenHtmlVoice(html);
    expect((out.html.match(/[가-힣]되죠\./g) || []).length).toBe(2);
    expect((out.html.match(/[가-힣]됩니다\./g) || []).length).toBe(2);
  });

  it('⭐ 「…입니다 → 이죠/죠」는 낱말이 달라 반복으로 치지 않는다 (이 상한 밖)', () => {
    const html = ['문제', '사람', '기준', '방식']
      .map((w) => `<p>첫 문장은 그대로 둡니다. 핵심은 ${w}입니다.</p>`)
      .join('\n');
    const out = softenHtmlVoice(html);
    expect(out.changed).toBe(4);
  });

  it('⭐ 문장 하나를 바꾸는 규칙(softenSentence)은 그대로다 — 상한은 글 단위에서만', () => {
    expect(softenSentence('조건이 다르기 때문입니다.')).toBe('조건이 다르기 때문이거든요.');
  });

  it('⭐ 상한을 바꿀 수 있다 (1 이면 같은 꼬리는 한 번만)', () => {
    const html = '<p>먼저 봅니다. 다르기 때문입니다.</p><p>다시 봅니다. 또 다르기 때문입니다.</p>';
    expect(count(softenHtmlVoice(html, 2, 1).html, '때문이거든요.')).toBe(1);
  });
});
