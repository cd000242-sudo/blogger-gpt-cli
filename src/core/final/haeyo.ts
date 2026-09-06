/**
 * 합니다체 → 해요체 기계 치환의 활용 규칙. (v3.8.676)
 *
 * 실측 결함: "낫습니다 → 낫아요"(ㅅ 불규칙), "페이지입니다 → 페이지이에요"(받침 없는 명사 뒤는 "예요"),
 * "큽니다·됩니다·다릅니다" 는 아예 안 바뀌었다(ㅂ니다 가 어간에 붙은 꼴을 못 봤다).
 * 모델이 대부분 해요체로 쓰므로 이 치환은 남은 몇 문장을 맞추는 그물이다 — 그물이 틀리면 글에 없던 결함을 만든다.
 *
 * 모르는 어간은 **바꾸지 않는다.** 틀린 해요체보다 남은 합니다체 한 문장이 낫다.
 */

const BASE = 0xac00;
const JUNG = 21;
const JONG = 28;

function decompose(ch: string): { cho: number; jung: number; jong: number } | null {
  const code = ch.charCodeAt(0) - BASE;
  if (code < 0 || code > 11171) return null;
  return { cho: Math.floor(code / (JUNG * JONG)), jung: Math.floor(code / JONG) % JUNG, jong: code % JONG };
}
function compose(cho: number, jung: number, jong: number): string {
  return String.fromCharCode(BASE + (cho * JUNG + jung) * JONG + jong);
}
export function hasFinal(ch: string): boolean {
  const d = decompose(ch);
  return !!d && d.jong !== 0;
}

// 모음 번호: ㅏ0 ㅐ1 ㅑ2 ㅒ3 ㅓ4 ㅔ5 ㅕ6 ㅖ7 ㅗ8 ㅘ9 ㅙ10 ㅚ11 ㅛ12 ㅜ13 ㅝ14 ㅞ15 ㅟ16 ㅠ17 ㅡ18 ㅢ19 ㅣ20
const BRIGHT = new Set([0, 2, 8, 12]);   // ㅏ ㅑ ㅗ ㅛ → 아요

/** 받침 없는 어간 + 아/어요 — 모음 축약 (가+아→가, 오+아→와, 주+어→줘, 쓰+어→써, 되+어→돼, 기+어→겨) */
function openStemHaeyo(ch: string): string | null {
  const d = decompose(ch);
  if (!d || d.jong !== 0) return null;
  switch (d.jung) {
    case 0: case 4: case 6: case 1: case 5: return `${ch}요`;                 // 가요 서요 켜요 내요 세요
    case 8: return `${compose(d.cho, 9, 0)}요`;                                // 보→봐요 오→와요
    case 13: return `${compose(d.cho, 14, 0)}요`;                               // 주→줘요 배우→배워요
    case 18: return `${compose(d.cho, 4, 0)}요`;                                // 쓰→써요 크→커요
    case 20: return `${compose(d.cho, 6, 0)}요`;                                // 기다리→기다려요 다니→다녀요
    case 11: return `${compose(d.cho, 10, 0)}요`;                               // 되→돼요 뵈→봬요
    case 16: return `${ch}어요`;                                                // 쉬→쉬어요 뛰→뛰어요
    default: return null;                                                       // ㅑ·ㅕ·ㅠ 등은 손대지 않는다
  }
}

/** ㅂ 불규칙 — "…ㅂ습니다" 꼴의 어간. 끝 글자에서 ㅂ 을 떼고 워요/와요 */
const B_IRREGULAR = /(?:쉽|어렵|가깝|무겁|가볍|춥|덥|맵|눕|굽|밉|부럽|즐겁|두렵|괴롭|귀엽|놀랍|반갑|고맙|외롭|새롭|까다롭|날카롭|번거롭|해롭|이롭|흥미롭|자유롭|여유롭|다채롭|평화롭|향기롭|슬기롭|지혜롭|사랑스럽|자연스럽|조심스럽|부담스럽|만족스럽|의심스럽|걱정스럽|고통스럽|당황스럽|실망스럽|자랑스럽|믿음직스럽|아름답|정답|촌스럽|어른스럽|여성스럽|남자답|사람답)$/;
const S_IRREGULAR: Record<string, string> = { 낫: '나아요', 짓: '지어요', 잇: '이어요', 붓: '부어요', 긋: '그어요', 젓: '저어요' };
const D_IRREGULAR: Record<string, string> = { 듣: '들어요', 걷: '걸어요', 싣: '실어요', 묻: '물어요', 깨닫: '깨달아요' };
const H_IRREGULAR: Record<string, string> = { 그렇: '그래요', 이렇: '이래요', 저렇: '저래요', 어떻: '어때요', 빨갛: '빨개요', 파랗: '파래요', 하얗: '하얘요', 까맣: '까매요', 노랗: '노래요', 동그랗: '동그래요' };
const REU_IRREGULAR: Record<string, string> = { 다르: '달라요', 모르: '몰라요', 빠르: '빨라요', 부르: '불러요', 오르: '올라요', 흐르: '흘러요', 이르: '일러요', 기르: '길러요', 누르: '눌러요', 자르: '잘라요', 고르: '골라요', 서두르: '서둘러요', 게으르: '게을러요', 들르: '들러요', 머무르: '머물러요', 저지르: '저질러요', 찌르: '찔러요', 마르: '말라요', 바르: '발라요', 나르: '날라요', 지르: '질러요', 무르: '물러요' };

/** "…습니다" 꼴 (받침 있는 어간) */
export function fromSeumnida(stem: string): string | null {
  const last = stem.slice(-1);
  const d = decompose(last);
  if (!d || d.jong === 0) return null;
  for (const [k, v] of Object.entries(S_IRREGULAR)) if (stem.endsWith(k)) return stem.slice(0, -k.length) + v;
  for (const [k, v] of Object.entries(D_IRREGULAR)) if (stem.endsWith(k)) return stem.slice(0, -k.length) + v;
  for (const [k, v] of Object.entries(H_IRREGULAR)) if (stem.endsWith(k)) return stem.slice(0, -k.length) + v;
  const b = stem.match(B_IRREGULAR);
  if (b) {
    const head = stem.slice(0, -1);
    const bare = compose(d.cho, d.jung, 0);
    // 돕·곱 처럼 한 글자 양성 어간은 "와요", 나머지는 "워요"
    const ending = (stem.length === 1 && (d.jung === 8)) ? '와요' : '워요';
    return `${head}${bare}${ending}`;
  }
  // 규칙 활용: 좋→좋아요, 있→있어요, 없→없어요, 받→받아요, 먹→먹어요
  return `${stem}${BRIGHT.has(d.jung) ? '아요' : '어요'}`;
}

/** "…ㅂ니다" 꼴 (받침 없는 어간에 ㅂ 이 붙은 것: 갑니다·봅니다·됩니다·큽니다·다릅니다) */
export function fromBnida(fused: string): string | null {
  const last = fused.slice(-1);
  const d = decompose(last);
  if (!d || d.jong !== 17) return null;                // 받침 ㅂ 이어야 한다 (17 = ㅂ)
  const bare = compose(d.cho, d.jung, 0);
  const stem = fused.slice(0, -1) + bare;
  for (const [k, v] of Object.entries(REU_IRREGULAR)) if (stem.endsWith(k)) return stem.slice(0, -k.length) + v;
  if (stem.endsWith('하')) return `${stem.slice(0, -1)}해요`;
  const open = openStemHaeyo(bare);
  return open ? `${stem.slice(0, -1)}${open}` : null;
}

/** "…입니다" — 받침 없는 명사 뒤는 "예요", 있는 명사 뒤는 "이에요" */
export function fromImnida(prev: string): string {
  const last = String(prev || '').slice(-1);
  return last && hasFinal(last) ? '이에요' : '예요';
}

/**
 * 문장 끝 합니다체를 해요체로. 태그·주소는 부르는 쪽이 걸러서 넘긴다.
 * 바꾸지 못하는 어간은 그대로 둔다.
 */
export function toHaeyo(text: string): string {
  return String(text || '')
    // "…입니다." — 앞 글자를 본다 ("페이지입니다 → 페이지예요", "사람입니다 → 사람이에요"). "아닙니다" 는 "아니에요"
    .replace(/아닙니다(?=[.!?])/g, '아니에요')
    .replace(/([가-힣A-Za-z0-9)）\]」』])입니다(?=[.!?])/g, (_m, prev: string) => `${prev}${/[가-힣]/.test(prev) ? fromImnida(prev) : '예요'}`)
    .replace(/입니다(?=[.!?])/g, '이에요')
    .replace(/합니다(?=[.!?])/g, '해요')
    // "…습니다." — 받침 있는 어간 (있·없·좋·낫·듣·쉽·그렇)
    .replace(/([가-힣]+)습니다(?=[.!?])/g, (m, stem: string) => {
      const last = stem.slice(-1);
      if (!hasFinal(last)) return m;                                  // "…스습니다" 같은 이상한 꼴은 두지 않는다
      // 어간은 마지막 한두 글자면 충분하다 — 앞말(목적어·부사)은 그대로
      const r = fromSeumnida(stem.length >= 3 ? stem.slice(-2) : stem);
      if (!r) return m;
      return stem.length >= 3 ? `${stem.slice(0, -2)}${r}` : r;
    })
    // "…ㅂ니다." — 받침 없는 어간 (갑·봅·됩·큽·다릅·기다립)
    .replace(/([가-힣]+)니다(?=[.!?])/g, (m, fused: string) => {
      const r = fromBnida(fused.length >= 3 ? fused.slice(-3) : fused);
      if (!r) return m;
      return fused.length >= 3 ? `${fused.slice(0, -3)}${r}` : r;
    });
}
