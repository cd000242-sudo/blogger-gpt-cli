import { parseCpcReport, usableSlots } from '../src/core/keywords/cpc-report';
import { pickBestReport, reportDateOf, REPORT_NAME_HINT } from '../src/core/keywords/drive-report';

/*
 * v3.8.643 — 리포트 생성기를 올렸더니 서식이 통째로 바뀌었다.
 *
 * 사장님: "업그레이드해서 방금 구글드라이버에 올렸어"
 *
 * 실측 2026-09-05, 같은 폴더에 두 리포트가 나란히 있다:
 *   01:03 「2026-09-05 고CPC 키워드 리포트」          — 슬롯 A/B/C 꼴
 *   05:30 「2026-09-05 네이버 상위노출 키워드 리포트 (v5 시범)」 — 슬롯이 없고 번호 항목
 *
 * 두 가지가 동시에 막고 있었다:
 *   ① 드라이브 검색이 「고CPC」 로 못박혀 새 리포트를 아예 못 찾는다
 *   ② 파서가 「슬롯」 머리글만 봐서 번호 항목을 0개로 읽는다
 */
describe('v3.8.643 v5 리포트 서식', () => {
  const v5 = [
    '# 2026-09-05 네이버 상위노출 키워드 리포트 (v5 시범 실행)',
    '',
    '## 1\\. 환경개선부담금 면제 — 자동차·세금 / 최우선',
    '',
    '**출처 기사**: 글로벌에픽 「이천시, 노후 경유차」 2026-09-05 http://example.com/a',
    '',
    '**확정 제목 (44자)** `환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한`',
    '',
    '**롱테일 파생**',
    '',
    '1. 면제 대상인데 고지서가 온 경우 이의신청과 소급 환급',
    '2. 배출가스저감장치 3년 면제 기산점과 장치 탈거 시 처리',
    '3. 9월 30일 넘겼을 때 가산금 3%와 압류까지 걸리는 기간',
    '',
    '**발행 전 확인**: 면제 신청 서식이 지자체별로 다른지 환경부 원문 확인.',
    '',
    '---',
    '',
    '## 2\\. 영암 농촌기본수당 월출페이 — 지원금',
    '',
    '**확정 제목 (45자)** `영암 농촌기본수당 10만원 신청 기준일과 월출페이 지급 차이`',
    '',
    '**롱테일 파생**',
    '',
    '1. 기준일 이후 전입한 경우',
    '',
    '**발행 전 확인**: 영암군 공고 원문으로 확인.',
    '',
  ].join('\n');

  describe('번호 항목을 읽는다', () => {
    const r = parseCpcReport(v5);

    test('항목 수와 날짜', () => {
      expect(r.date).toBe('2026-09-05');
      expect(usableSlots(r)).toHaveLength(2);
    });

    /** 머리글은 "키워드 — 분류" 꼴이다. 분류까지 키워드에 넣으면 검색어가 망가진다 */
    test('키워드는 구분자 앞까지만', () => {
      expect(r.slots[0]!.keyword).toBe('환경개선부담금 면제');
      expect(r.slots[0]!.label).toBe('자동차·세금 / 최우선');
    });

    /** 콜론 없이 백틱으로 온다 — 예전 규칙(낫표·콜론)으로는 못 찾는다 */
    test('확정 제목을 백틱에서 꺼낸다', () => {
      expect(r.slots[0]!.title).toContain('9월 30일 납부기한');
      expect(r.slots[0]!.title).not.toContain('`');
    });

    test('롱테일을 번호 목록에서 읽는다 — 이게 설계도의 알맹이다', () => {
      expect(r.slots[0]!.longtails).toHaveLength(3);
      expect(r.slots[0]!.longtails[0]).toContain('고지서가 온 경우');
    });

    /** v5 는 목록이 아니라 한 줄로 온다 */
    test('발행 전 확인이 한 줄이어도 읽는다', () => {
      expect(r.slots[0]!.mustCheck).toHaveLength(1);
      expect(r.slots[0]!.mustCheck[0]).toContain('환경부');
    });
  });

  describe('옛 슬롯 꼴을 깨뜨리지 않는다', () => {
    const 슬롯꼴 = [
      '# 2026-09-04 고CPC 키워드 리포트',
      '',
      '# 슬롯 A - 시의성 (워드프레스)',
      '## 키워드: 성과급 요구 파업이 불법으로 갈리는 선',
      '### 확정 제목',
      '**확정 (40자):** 「성과급 요구 파업이 불법으로 갈리는 선」',
      '### 롱테일 파생 키워드',
      '- 쟁의행위 대상 판단',
      '',
    ].join('\n');

    /** 둘 다 시도하면 한 리포트에서 항목이 두 벌로 늘어난다 */
    test('슬롯 꼴이면 번호 항목으로 다시 읽지 않는다', () => {
      const r = parseCpcReport(슬롯꼴);
      expect(r.slots).toHaveLength(1);
      expect(r.slots[0]!.slot).toBe('A');
      expect(r.slots[0]!.longtails).toHaveLength(1);
    });
  });

  describe('드라이브에서 찾기', () => {
    /** 「고CPC」 로 못박아 뒀더니 새 리포트를 아예 못 찾았다 */
    test('가운데 말을 못박지 않는다', () => {
      expect(REPORT_NAME_HINT).toBe('키워드 리포트');
      expect(reportDateOf('2026-09-05 네이버 상위노출 키워드 리포트 (v5 시범)')).toBe('2026-09-05');
      expect(reportDateOf('2026-09-04 고CPC 키워드 리포트')).toBe('2026-09-04');
    });

    /** 같은 폴더에 하루 열몇 개씩 쌓이는 장부를 리포트로 착각하면 안 된다 */
    test('키워드 장부는 후보가 아니다', () => {
      expect(reportDateOf('키워드 장부 2026-09-05 (13/13) 학습·카테고리')).toBe('');
    });

    const 오늘둘 = [
      { id: 'old', name: '2026-09-05 고CPC 키워드 리포트', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-09-05T01:03:45Z' },
      { id: 'v5', name: '2026-09-05 네이버 상위노출 키워드 리포트 (v5 시범)', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-09-05T05:30:21Z' },
    ];

    /**
     * v3.8.644 — 사장님: "이제 네이버 상위노출 키워드 리포트를 찾으면되"
     * 시각이 아니라 이름으로 고른다. 시각으로만 고르면 어느 날 옛 리포트가
     * 더 늦게 올라오는 순간 조용히 그쪽으로 넘어간다.
     */
    test('같은 날이면 네이버 상위노출 리포트를 먼저 쓴다', () => {
      expect(pickBestReport(오늘둘)!.id).toBe('v5');
    });

    test('옛 리포트가 더 늦게 올라와도 네이버 쪽을 쓴다', () => {
      const 뒤집힘 = [
        { ...오늘둘[0]!, modifiedTime: '2026-09-05T23:00:00Z' },
        오늘둘[1]!,
      ];
      expect(pickBestReport(뒤집힘)!.id).toBe('v5');
    });

    /** 그날 새 리포트가 없으면 있는 것이라도 보여 준다 — 텅 빈 화면보다 낫다 */
    test('네이버 리포트가 없는 날은 있는 것을 쓴다', () => {
      expect(pickBestReport([오늘둘[0]!])!.id).toBe('old');
    });

    /** 다른 리포트의 md 원문을 집으면 더 오래된 것으로 되돌아간다 — 예전 규칙의 구멍 */
    test('md 원문은 그 리포트의 것만 쓴다', () => {
      const 섞임 = [
        ...오늘둘,
        { id: 'old-md', name: '2026-09-05 고CPC 키워드 리포트 (원문 md 백업)', mimeType: 'text/markdown', modifiedTime: '2026-09-05T01:05:00Z' },
      ];
      expect(pickBestReport(섞임)!.id).toBe('v5');
    });

    test('짝이 맞는 md 원문이면 그쪽을 쓴다', () => {
      const 짝 = [
        오늘둘[1]!,
        { id: 'v5-md', name: '2026-09-05 네이버 상위노출 키워드 리포트 (v5 시범) (원문 md 백업)', mimeType: 'text/markdown', modifiedTime: '2026-09-05T05:31:00Z' },
      ];
      expect(pickBestReport(짝)!.id).toBe('v5-md');
    });
  });
});
