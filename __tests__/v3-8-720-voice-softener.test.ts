/**
 * 사람 말투 어미 섞기 (v3.8.720)
 *
 * 사장님: "말투를 좀 더 자연스럽게 사람처럼 나오게 해줘. ~합니다 ~입니다 ~습니다만 쓰는 게 아니라
 *          ~하죠 ~하는 이유죠 등등 있잖아"
 *
 * 실측(블로그스팟 이혼 글): "구분합니다/구분해야" 17회, "~편이 낫습니다" 6회.
 * 문장 끝이 전부 같으면 내용이 좋아도 기계가 읽는 소리가 난다.
 *
 * ## 만들면서 두 번 되돌린 것 — 이 테스트가 그 자리를 잠근다
 *   ① 「~합니다 → ~하죠」를 전부 열었더니 "서명을 보류하죠", "자산 목록을 정리하죠" 가 나왔다.
 *      행동 동사 + 죠 는 **청유**로 읽힌다. 법률 안내에서 지시가 제안으로 물러지면 뜻이 달라진다.
 *   ② "있는지죠", "검토죠" 같은 없는 말이 나왔다 — 받침과 의존·동작명사를 안 본 탓이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { softenSentence, softenParagraph, softenHtmlVoice } from '../src/core/final/voice-softener';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 서술 문장에만 어미를 섞는다', () => {
  it('⭐⭐ 설명·판단 문장은 바뀐다', () => {
    expect(softenSentence('채무도 고려될 수 있다고 설명합니다.')).toBe('채무도 고려될 수 있다고 설명하죠.');
    expect(softenSentence('실제 자료와 대조하는 접근이 필요합니다.')).toBe('실제 자료와 대조하는 접근이 필요하죠.');
    expect(softenSentence('그 빈칸이 협의할 대상입니다.')).toBe('그 빈칸이 협의할 대상이죠.');
    expect(softenSentence('부부가 형성한 재산을 나누는 문제입니다.')).toBe('부부가 형성한 재산을 나누는 문제죠.');
  });

  it('⭐⭐ 이유를 말하는 문장은 거든요로', () => {
    expect(softenSentence('함께 검토하도록 설명하기 때문입니다.')).toBe('함께 검토하도록 설명하기 때문이거든요.');
  });
});

describe('② 행동 지시 문장은 건드리지 않는다 (청유가 되면 뜻이 달라진다)', () => {
  for (const sentence of [
    '의미를 확인하기 전 서명을 보류합니다.',
    '자산 목록뿐 아니라 관련 채무도 함께 정리합니다.',
    '상담 자료로 준비합니다.',
    '수정 제안을 별도로 작성합니다.',
    '현재 지출 내역을 기록합니다.',
  ]) {
    it(`⭐⭐ 그대로 둔다: ${sentence}`, () => {
      expect(softenSentence(sentence)).toBe(sentence);
    });
  }
});

describe('③ 뜻이 흔들리면 안 되는 문장은 손대지 않는다', () => {
  for (const sentence of [
    '대응 기한은 법원 안내로 확인합니다.',
    '협의이혼의사확인 후에는 3개월 이내에 신고해야 합니다.',
    '구체적인 청구 가능성은 변호사 상담을 권고합니다.',
    '본 글은 법률 일반 정보 제공 목적입니다.',
  ]) {
    it(`⭐⭐ 그대로 둔다: ${sentence.slice(0, 24)}…`, () => {
      expect(softenSentence(sentence)).toBe(sentence);
    });
  }
});

describe('④ 없는 말을 만들지 않는다', () => {
  it('⭐⭐ 의존명사 뒤 「입니다」는 건드리지 않는다', () => {
    const s = '먼저 확인할 것은 맞지 않는 부분이 있는지입니다.';
    expect(softenSentence(s)).toBe(s);          // "있는지죠" 는 없는 말이다
  });

  it('⭐⭐ 동작명사 뒤도 건드리지 않는다', () => {
    const s = '그대로 수락하는 일을 피하기 위한 검토입니다.';
    expect(softenSentence(s)).toBe(s);          // "검토죠" 는 뚝 끊긴다
  });

  it('⭐⭐ 받침에 따라 이죠/죠를 가른다', () => {
    expect(softenSentence('상담에서 검토할 문서가 달라지는 지점입니다.')).toBe('상담에서 검토할 문서가 달라지는 지점이죠.');
    expect(softenSentence('이건 흔한 문제입니다.')).toBe('이건 흔한 문제죠.');
  });

  it('⭐ 모르는 어미는 그대로 둔다', () => {
    const s = '상대방이 먼저 연락해 왔더군요.';
    expect(softenSentence(s)).toBe(s);
  });
});

describe('⑤ 문단의 첫 문장은 지킨다 · 문단마다 두 개까지만', () => {
  it('⭐⭐ 첫 문장은 안 바꾼다 (뼈대가 물러진다)', () => {
    const text = '이것이 핵심 문제입니다. 관련 채무도 고려된다고 설명합니다. 접근이 필요합니다.';
    const out = softenParagraph(text);
    expect(out.text.startsWith('이것이 핵심 문제입니다.')).toBe(true);
  });

  it('⭐⭐ 한 문단에서 두 문장까지만 바꾼다', () => {
    const text = [
      '첫 문장입니다.',
      '이것도 설명합니다.',
      '저것도 설명합니다.',
      '그것도 설명합니다.',
      '마지막도 설명합니다.',
    ].join(' ');
    expect(softenParagraph(text, 2).changed).toBe(2);
  });
});

describe('⑥ HTML 구조를 건드리지 않는다', () => {
  it('⭐⭐ 태그와 속성은 한 글자도 안 바뀐다', () => {
    const html = '<p class="article-p" style="color:#111"><strong>첫 문장입니다.</strong> 관련 채무도 고려된다고 설명합니다.</p>';
    const out = softenHtmlVoice(html);
    expect(out.html).toContain('class="article-p" style="color:#111"');
    expect(out.html).toContain('<strong>첫 문장입니다.</strong>');
    expect(out.html).toContain('설명하죠.');
  });

  it('⭐⭐ 문단이 <strong>으로 시작해도 문장을 센다 (조각마다 세면 한 개도 안 바뀐다)', () => {
    const html = '<p><strong>통보가 입증하지는 않습니다.</strong> 접근이 필요합니다.</p>';
    expect(softenHtmlVoice(html).changed).toBe(1);
  });

  it('⭐⭐ 소제목·표·링크 안은 건너뛴다', () => {
    const html = '<h2>재산을 나누는 문제입니다.</h2><td>대상입니다.</td><a href="#">필요합니다.</a>';
    expect(softenHtmlVoice(html).changed).toBe(0);
    expect(softenHtmlVoice(html).html).toBe(html);
  });

  it('⭐ 바꿀 게 없으면 원본 그대로', () => {
    const html = '<p>본 글은 법률 일반 정보 제공 목적입니다.</p>';
    expect(softenHtmlVoice(html).html).toBe(html);
  });
});

describe('⑦ 발행 경로 양쪽에 배선돼 있다', () => {
  it('⭐⭐ API 경로(orchestration)', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain("await import('./voice-softener')");
    expect(orch).toMatch(/html = voiced\.html/);
  });

  it('⭐⭐ 에이전트 경로(main) — orchestration 을 안 타므로 따로 부른다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain("require('../dist/core/final/voice-softener')");
    expect(main).toMatch(/result\.content = voiced\.html/);
  });

  it('⭐⭐ 격식 말투와 영문 모드는 건너뛴다', () => {
    for (const src of [read('src/core/final/orchestration.ts'), read('electron/main.ts')]) {
      expect(src).toMatch(/toneStyle !== 'formal' && !isEnglish/);
    }
  });
});
