/**
 * 🧹 CLEAN — 긁어 온 본문에서 **본문이 아닌 것**을 걷어낸다. (v3.8.734)
 *
 * 실측(2026-09-22, "청년미래적금 2차 신청" 본문 프롬프트): 근거 190줄 중 59줄이
 * `Advertisement` · 페이스북/카카오톡 공유 버튼 · 기자 메일 · `100자평 0` · `댓글` 이었다.
 * 추출기는 "기사 컨테이너"를 잘 찾지만, 그 컨테이너 안에 광고 자리·공유 막대·관련기사가 같이 들어 있다.
 *
 * ## 낱말이 아니라 **줄(블록)** 을 지운다
 * "광고" 라는 낱말을 지우면 "광고 규제가 바뀌었다" 는 본문 문장이 망가진다.
 * 그래서 ① 줄 전체가 껍데기일 때만 지우고 ② 같은 줄이 되풀이되면(사이트 공통 문구) 지우고
 * ③ "관련기사 / 많이 본 뉴스 / 저작권자" 뒤는 꼬리로 보고 잘라 낸다.
 * 문장(마침표로 끝나는 25자 이상)은 어떤 규칙에도 걸리지 않게 먼저 살린다.
 */

export interface CleanResult {
  text: string;
  rawLength: number;
  cleanLength: number;
  removedLength: number;
  removedLines: number;
}

/** 줄 전체가 이 모양이면 껍데기다 */
const SHELL_LINE: RegExp[] = [
  /^(advertisement|ad|sponsored|광고|AD)$/i,
  /^(댓글|답글|공유|공유하기|스크랩|인쇄|인쇄하기|북마크|글자\s*크기|글씨\s*크기|가|가\+|가-|URL\s*복사|주소\s*복사|기사\s*저장|신고|좋아요|추천|구독|구독하기|팔로우|닫기|더보기|목록|이전|다음|top|맨\s*위로)$/i,
  /^(페이스북|트위터|엑스|X|카카오톡|카카오스토리|카카오|네이버|네이버\s*공유|밴드|라인|텔레그램|핀터레스트|링크드인|인스타그램|유튜브|이메일|메일)(\s*(공유|보내기|로\s*보내기))?(\s*\d+)?$/i,
  /^\d*\s*자평\s*\d*$/,
  /^(100자평|댓글\s*\d+|좋아요\s*\d+|공유\s*\d+|조회(수)?\s*[\d,]+)$/,
  /^(입력|수정|등록|업데이트|기사입력|최종수정|승인)\s*[:：]?\s*20\d{2}[.\-/]/,
  /^[\w.+-]+@[\w-]+\.[\w.-]+$/,
  /^.{0,12}\s*기자\s*$/,
  /^.{0,14}\s*기자\s+[\w.+-]+@[\w-]+\.[\w.-]+$/,
  /^(사진|자료|출처|제공|그래픽|영상)\s*[=:：]\s*.{0,40}$/,
  /^\[?(사진|자료)\s*(출처|제공)\]?/,
  /(무단\s*전재|재배포\s*금지|무단\s*복제|저작권자|all rights reserved|copyright|ⓒ|©)/i,
  /^(로그인|회원가입|로그아웃|마이페이지|앱\s*(설치|다운로드)|앱에서\s*보기|앱으로\s*보기|알림\s*받기|뉴스레터\s*(구독|신청))/,
  /(로그인(이|을)?\s*(필요|해\s*주세요|하시면)|앱을?\s*설치|구독하(시면|고)|채널\s*추가|이\s*기사를\s*추천)/,
  /^(홈|뉴스|정치|경제|사회|문화|스포츠|연예|국제|오피니언|전체\s*메뉴|메뉴|검색|사이트맵)$/,
  /^←\s*홈으로/,
  /^(기사\s*제보|제보하기|기사\s*문의|광고\s*문의|고객\s*센터|개인정보\s*(처리|취급)\s*방침|이용\s*약관|청소년\s*보호\s*정책)/,
];

/** 이 줄부터는 본문이 끝났다 — 뒤를 통째로 버린다 (본문의 60% 지점 이후에 나올 때만) */
const TAIL_MARKER = /^(관련\s*기사|관련\s*뉴스|추천\s*기사|추천\s*뉴스|많이\s*본\s*(기사|뉴스)|인기\s*(기사|뉴스)|주요\s*(기사|뉴스)|최신\s*(기사|뉴스)|실시간\s*(뉴스|인기)|이\s*시각\s*(주요|인기)|함께\s*(보면|읽으면)\s*좋은|오늘의\s*(핫|인기)|핫\s*이슈|HOT\s*(뉴스|이슈)|베스트\s*(클릭|댓글)|댓글\s*\d*\s*개?$|댓글\s*쓰기|기자의\s*다른\s*기사|.{0,10}기자의\s*(최신|다른)\s*기사)/i;

/** 문장으로 보이면 어떤 규칙에도 안 걸린다 */
function looksLikeSentence(line: string): boolean {
  return line.length >= 25 && /(다|요|죠|음|함|임|됨)[.!?…"”']?\s*$/.test(line);
}

function isShellLine(line: string): boolean {
  if (looksLikeSentence(line)) return false;
  return SHELL_LINE.some((re) => re.test(line));
}

export function cleanEvidenceText(raw: unknown): CleanResult {
  const source = String(raw ?? '').replace(/\r\n?/g, '\n');
  const rawLength = source.length;
  const lines = source.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim());

  // ① 꼬리 자르기 — 본문 뒤쪽에 나온 "관련기사" 류 표지부터 버린다
  let end = lines.length;
  const tailFrom = Math.floor(lines.length * 0.6);
  for (let i = tailFrom; i < lines.length; i += 1) {
    if (lines[i] && lines[i]!.length <= 30 && TAIL_MARKER.test(lines[i]!)) { end = i; break; }
  }
  const body = lines.slice(0, end);

  // ② 되풀이 줄 — 같은 짧은 줄이 두 번 넘게 나오면 사이트 공통 문구다 (문장은 제외)
  const counts = new Map<string, number>();
  for (const l of body) if (l && l.length <= 40 && !looksLikeSentence(l)) counts.set(l, (counts.get(l) || 0) + 1);

  const kept: string[] = [];
  let removedLines = lines.length - end;
  for (const l of body) {
    if (!l) { if (kept.length && kept[kept.length - 1] !== '') kept.push(''); continue; }
    const repeated = (counts.get(l) || 0) >= 3;
    // 아주 짧은 조각(메뉴·버튼 라벨). 숫자·단위가 있으면 표의 칸일 수 있어 살린다
    const fragment = l.length <= 6 && !/\d/.test(l) && !/[.!?]$/.test(l);
    if (isShellLine(l) || repeated || fragment) { removedLines += 1; continue; }
    kept.push(l);
  }

  const text = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const result = { text, rawLength, cleanLength: text.length, removedLength: Math.max(0, rawLength - text.length), removedLines };
  totals.raw += result.rawLength; totals.clean += result.cleanLength; totals.lines += removedLines; totals.docs += 1;
  return result;
}

/** 한 편을 만드는 동안 정제한 총량 — 추출기 안에서 도는 정제까지 합쳐 단계 로그에 한 줄로 보여 주려고 센다 */
const totals = { raw: 0, clean: 0, lines: 0, docs: 0 };
export function resetCleanTotals(): void { totals.raw = 0; totals.clean = 0; totals.lines = 0; totals.docs = 0; }
export function getCleanTotals(): { raw: number; clean: number; lines: number; docs: number } { return { ...totals }; }

/** 남은 껍데기 줄의 비율 — 회귀 테스트가 "정제가 됐는가"를 수치로 본다 */
export function shellLineRatio(text: string): number {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 0;
  return lines.filter((l) => isShellLine(l) || (l.length <= 6 && !/\d/.test(l) && !/[.!?]$/.test(l))).length / lines.length;
}

/** 디버그 로그 한 줄 — RAW / CLEAN / removed */
export function describeClean(label: string, r: CleanResult): string {
  return `[CLEAN] ${label} RAW ${r.rawLength}자 → CLEAN ${r.cleanLength}자 (removed ${r.removedLength}자 · ${r.removedLines}줄)`;
}
