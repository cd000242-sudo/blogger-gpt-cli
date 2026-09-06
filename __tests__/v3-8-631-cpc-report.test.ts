const fs = require('fs');
const os = require('os');
const path = require('path');

import {
  parseCpcReport,
  usableSlots,
  buildReportDirective,
  checkReportCompliance,
  instructionCovered,
  unescapeMarkdown,
} from '../src/core/keywords/cpc-report';
import {
  findLatestReport,
  isNewReport,
  loadLatestReport,
  writeImportState,
  readImportState,
} from '../src/core/keywords/report-source';

/*
 * v3.8.631 — 매일 만들어지는 고CPC 키워드 리포트를 앱이 읽는다.
 *
 * ## 왜 필요했나
 * 실측 2026-09-04: 그날 리포트가 슬롯 A 로 뽑은 것이 그날 발행된 글과 같은 제목인데,
 * 리포트의 「롱테일 파생」 3개와 「발행 전 확인 필요」 5개 중
 * **글에 반영된 것은 2개뿐이었다.**
 * 재료가 없어 글이 얕았던 게 아니라, 최고급 재료를 만들어 놓고 안 썼다.
 *
 * ## 사생활
 * 폴더 경로를 코드에 적지 않는다. 설정이 없으면 기능이 아예 안 켜진다.
 */

/** 실제 리포트와 같은 꼴 — 구글 문서 백업이라 마크다운이 탈출돼 있다 */
const 리포트 = [
  String.raw`\# 2026-09-04 고CPC 키워드 리포트`,
  '',
  String.raw`\# 슬롯 A - 시의성·디스커버형 (워드프레스)`,
  String.raw`\#\# 키워드: 성과급 요구 파업이 불법으로 갈리는 선`,
  String.raw`\*\*등급: 통과 (게이트 판정)\*\*`,
  '',
  String.raw`\#\#\# CPC 근거 / 트랙`,
  String.raw`\*\*배정 트랙: 워드프레스\*\*`,
  '',
  String.raw`\#\#\# 제목안 (디스커버형)`,
  String.raw`\- \*\*확정 (33자):\*\* 「성과급 요구 파업이 불법으로 갈리는 선, 9·3 노동부 지침」`,
  String.raw`\- \*\*예비1 (31자):\*\* 「9·3 지침 뒤, 파업하면 손해배상」`,
  '',
  String.raw`\#\#\# 롱테일 파생`,
  String.raw`1\. 성과급 \*\*지급 시기·산정 기준\*\*을 두고 하는 파업은 여전히 쟁의 대상인가`,
  String.raw`2\. 지침은 법률이 아니다 - 노동위 실무 기준과 법원 판단이 갈릴 수 있는 지점`,
  '',
  String.raw`\#\#\# 발행 전 확인 필요`,
  String.raw`1\. ★보도자료 원문에서 지침의 정식 명칭과 시행일을 확인할 것.`,
  String.raw`2\. 'N%' 가 원문 문구인지 언론 요약인지 확인할 것.`,
  '',
  String.raw`\# 슬롯 B - 시의성·분쟁형 (티스토리): \*\*미확보\*\*`,
  String.raw`\#\#\# 사유`,
  '개인 대상 신규 발표가 없었다.',
  '',
  String.raw`\# 참고 URL`,
  String.raw`\- 보도: https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=19876`,
  String.raw`\- 해설: https://www.lawtimes.co.kr/news/articleViewAmp.html?idxno=225825`,
].join('\n');

describe('v3.8.631 고CPC 키워드 리포트', () => {
  describe('읽기 — 구글 문서 백업 형식', () => {
    /** 실측: `\# 슬롯 A` 꼴이라 역이스케이프 없이는 제목을 하나도 못 찾는다 */
    test('탈출된 마크다운을 되돌린다', () => {
      expect(unescapeMarkdown(String.raw`\# 제목 \*\*굵게\*\* 1\.`)).toBe('# 제목 **굵게** 1.');
    });

    test('날짜와 슬롯을 뽑는다', () => {
      const r = parseCpcReport(리포트);
      expect(r.date).toBe('2026-09-04');
      expect(r.slots.map((s) => s.slot)).toEqual(['A', 'B']);
    });

    test('확정 제목을 낫표 안에서 꺼낸다 — 예비안을 집지 않는다', () => {
      const a = parseCpcReport(리포트).slots[0]!;
      expect(a.title).toBe('성과급 요구 파업이 불법으로 갈리는 선, 9·3 노동부 지침');
      expect(a.title).not.toContain('손해배상');
    });

    test('롱테일과 발행 전 확인을 각각 모은다', () => {
      const a = parseCpcReport(리포트).slots[0]!;
      expect(a.longtails).toHaveLength(2);
      expect(a.mustCheck).toHaveLength(2);
      // 다음 절을 먹지 않는다 — 고정 길이로 자르면 섞인다
      expect(a.longtails.join(' ')).not.toContain('보도자료');
    });

    test('키워드·등급·트랙을 뽑는다', () => {
      const a = parseCpcReport(리포트).slots[0]!;
      expect(a.keyword).toContain('성과급 요구 파업');
      expect(a.grade).toContain('통과');
      expect(a.track).toContain('워드프레스');
    });

    test('미확보 슬롯을 알아본다 — 없는 시의성을 만들지 않는다', () => {
      const b = parseCpcReport(리포트).slots[1]!;
      expect(b.empty).toBe(true);
      expect(usableSlots(parseCpcReport(리포트)).map((s) => s.slot)).toEqual(['A']);
    });

    test('참고 URL 을 중복 없이 모은다', () => {
      const r = parseCpcReport(리포트);
      expect(r.urls).toHaveLength(2);
      expect(r.urls[0]).toContain('moel.go.kr');
    });

    test('빈 입력에도 터지지 않는다', () => {
      expect(parseCpcReport('').slots).toEqual([]);
      expect(usableSlots(parseCpcReport(''))).toEqual([]);
    });
  });

  describe('지시문 — 요약당하지 않게 못박는다', () => {
    const slot = parseCpcReport(리포트).slots[0]!;
    const 지시 = buildReportDirective(slot, parseCpcReport(리포트).urls);

    test('확정 제목을 그대로 쓰라고 한다', () => {
      expect(지시).toContain(slot.title);
      expect(지시).toContain('그대로 쓰세요');
    });

    test('롱테일을 구간으로 다루라고 한다 — 빠뜨리면 같은 말을 반복하게 된다', () => {
      for (const t of slot.longtails) expect(지시).toContain(t);
      expect(지시).toContain('각각의 구간');
    });

    test('확인 못 한 것은 쓰지 말라고 못박는다', () => {
      expect(지시).toContain('확인 못 한 것은 쓰지 않습니다');
      expect(지시).toContain('지어내면 안 됩니다');
    });

    test('출처를 먼저 읽으라고 한다', () => {
      expect(지시).toContain('moel.go.kr');
      // v3.8.667: 주소는 "읽으라" 가 아니라 "장부에 실려 있다" — 안 읽은 주소를 나열하면 모델이 내용을 지어내 인용했다
      expect(지시).toContain('본문은 위 근거 장부에 실려 있습니다');
      expect(지시).toContain('읽지 않은 주소의 내용을 지어내지 않습니다');
    });

    test('슬롯이 없으면 빈 문자열 — 없는 지시를 지어내지 않는다', () => {
      expect(buildReportDirective(undefined as any)).toBe('');
    });
  });

  describe('이행 검사 — 시켰다고 지켜지는 게 아니다', () => {
    const slot = parseCpcReport(리포트).slots[0]!;

    test('다룬 것과 빠뜨린 것을 가른다', () => {
      const 본문 = '성과급 지급 시기와 산정 기준을 두고 다투는 파업은 쟁의 대상인지 살펴봅니다.';
      const c = checkReportCompliance(slot, 본문);
      expect(c.coveredLongtails).toHaveLength(1);
      expect(c.missingLongtails).toHaveLength(1);
      expect(c.missingLongtails[0]).toContain('노동위');
    });

    test('표현을 바꿔 써도 다룬 것으로 본다 — 완전 일치를 요구하면 헛것을 잡는다', () => {
      const 본문 = '지침은 법률이 아니라 행정해석입니다. 노동위 실무와 법원 판단이 갈릴 수 있습니다.';
      expect(instructionCovered(slot.longtails[1]!, 본문)).toBe(true);
    });

    test('스치듯 한 낱말만 나온 것을 다뤘다고 하지 않는다', () => {
      expect(instructionCovered('보도자료 원문에서 지침의 정식 명칭과 시행일을 확인할 것', '지침을 설명합니다.')).toBe(false);
    });

    test('본문이 비면 전부 빠진 것으로 본다', () => {
      const c = checkReportCompliance(slot, '');
      expect(c.missingLongtails).toHaveLength(2);
      expect(c.missingChecks).toHaveLength(2);
    });
  });

  describe('파일 찾기 — 시각이 아니라 새 파일을 본다', () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-'));
    });

    const 쓰기 = (name: string, body = 리포트) => {
      const p = path.join(dir, name);
      fs.writeFileSync(p, body, 'utf-8');
      return p;
    };

    test('날짜가 최신인 파일을 고른다 — 복사 순서에 흔들리지 않는다', () => {
      쓰기('2026-09-02 고CPC 키워드 리포트.md');
      쓰기('2026-09-04 고CPC 키워드 리포트.md');
      쓰기('2026-09-03 고CPC 키워드 리포트.md');
      expect(findLatestReport(dir)!.date).toBe('2026-09-04');
    });

    test('리포트가 아닌 파일은 무시한다', () => {
      쓰기('메모.md');
      쓰기('2026-09-04 고CPC 키워드 리포트.md');
      expect(findLatestReport(dir)!.fileName).toContain('2026-09-04');
    });

    test('폴더가 없거나 설정이 비면 조용히 꺼진다 — 기능이 없는 것과 같다', () => {
      expect(findLatestReport('')).toBeNull();
      expect(findLatestReport(path.join(dir, '없는폴더'))).toBeNull();
      expect(loadLatestReport('', path.join(dir, 's.json')).report).toBeNull();
    });

    test('같은 리포트를 두 번 가져오지 않는다', () => {
      쓰기('2026-09-04 고CPC 키워드 리포트.md');
      const statePath = path.join(dir, 'state.json');

      const first = loadLatestReport(dir, statePath);
      expect(first.isNew).toBe(true);
      writeImportState(statePath, first.found!);

      expect(loadLatestReport(dir, statePath).isNew).toBe(false);
    });

    /** 할당량 때문에 늦게 만들어지든, 같은 날 다시 만들어지든 잡아야 한다 */
    test('같은 이름이라도 내용이 갱신되면 새 것으로 본다', () => {
      const p = 쓰기('2026-09-04 고CPC 키워드 리포트.md');
      const statePath = path.join(dir, 'state.json');
      const first = findLatestReport(dir)!;
      writeImportState(statePath, first);

      // 나중에 다시 만들어진 상황
      fs.utimesSync(p, new Date(), new Date(first.mtimeMs + 60_000));
      expect(isNewReport(findLatestReport(dir), readImportState(statePath))).toBe(true);
    });

    test('기록이 깨져 있으면 처음으로 본다 — 놓치는 쪽보다 낫다', () => {
      쓰기('2026-09-04 고CPC 키워드 리포트.md');
      const statePath = path.join(dir, 'state.json');
      fs.writeFileSync(statePath, '{망가짐', 'utf-8');
      expect(readImportState(statePath)).toBeNull();
      expect(loadLatestReport(dir, statePath).isNew).toBe(true);
    });

    test('읽은 결과를 사람이 읽을 한 줄로 말한다', () => {
      쓰기('2026-09-04 고CPC 키워드 리포트.md');
      const r = loadLatestReport(dir, path.join(dir, 's.json'));
      expect(r.note).toContain('2026-09-04');
      expect(r.note).toContain('슬롯');
    });
  });
});
