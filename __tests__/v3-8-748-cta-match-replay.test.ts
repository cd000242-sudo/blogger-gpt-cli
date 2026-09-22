/**
 * 748 — 저장된 live Run 3 산출물로 CTA 관문을 재생한다(유료 호출 0).
 * 그 실행에서 Judge 가 막은 CTA(국립경주박물관 전시 페이지 → "예약 안내 확인")가
 * 이제는 **Judge 까지 가기 전에** 빠지는지 본다. 산출물이 없는 기계에서는 건너뛴다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { checkCtaMatch } from '../src/cta/cta-match';

const RUN = path.join(__dirname, '..', 'quality-run-output', 'evidence-regression-live-loop-claude', '경주_APEC_기간_숙소_예약_c3');
const has = fs.existsSync(path.join(RUN, 'K-final-judge.json')) && fs.existsSync(path.join(RUN, 'B-clean-evidence.json'));

(has ? describe : describe.skip)('live Run 3 replay — Judge 가 막았던 CTA 를 관문이 먼저 뺀다', () => {
  const judge = JSON.parse(fs.readFileSync(path.join(RUN, 'K-final-judge.json'), 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(path.join(RUN, 'B-clean-evidence.json'), 'utf8')).items || [];
  const title = (JSON.parse(fs.readFileSync(path.join(RUN, 'D-title.json'), 'utf8')) || {}).title || '';
  const apex = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const lookup = (url: string) => {
    const want = apex(url);
    const hit = evidence.find((i: any) => String(i.url || '') === url) || evidence.find((i: any) => apex(String(i.url || '')) === want);
    return hit ? { title: String(hit.title || ''), text: String(hit.cleanedText || '').slice(0, 600) } : undefined;
  };

  it('그 실행의 Judge 는 CTA 를 문제 삼았다 (재생의 전제)', () => {
    const types = (judge.blockingIssues || []).map((b: any) => `${b.sectionId} ${b.type}`);
    expect(types.join(' | ')).toMatch(/CTA_OFFTOPIC|MIXED_ENTITY/);
  });

  it('⭐ 문제의 주소(gyeongju.museum.go.kr)는 관문에서 탈락한다 — 근거 장부에 있던 주소인데도', () => {
    const url = 'https://gyeongju.museum.go.kr/kor/html/sub03/030101.html';
    // 전제: 이 주소는 실제로 그 실행의 근거 장부에 있었다(그래서 기존 검사를 통과했다)
    expect(lookup(url)).toBeDefined();
    const v = checkCtaMatch({ keyword: '경주 APEC 기간 숙소 예약', title, action: '🔗 예약 안내 확인 · 예약은 아래 공식 안내에서 절차와 가능 여부를 확인할 수 있습니다', destination: { url, ...(lookup(url) || {}) } });
    expect(v.ok).toBe(false);
    expect(['CTA_DESTINATION_MATCH', 'CTA_ENTITY_MATCH', 'CTA_ACTION_MATCH']).toContain(v.failed);
  });

  it('같은 실행의 숙소 관련 근거 출처는 살아남는다 — 관문이 전부를 막지 않는다', () => {
    const lodging = evidence.find((i: any) => /숙소|숙박|객실|호텔/.test(`${i.title} ${String(i.cleanedText || '').slice(0, 200)}`));
    expect(lodging).toBeDefined();
    const v = checkCtaMatch({
      keyword: '경주 APEC 기간 숙소 예약', title,
      action: '🔗 예약 안내 확인',
      destination: { url: String(lodging.url), title: String(lodging.title || ''), text: String(lodging.cleanedText || '').slice(0, 600) },
    });
    expect(v.ok).toBe(true);
  });
});
