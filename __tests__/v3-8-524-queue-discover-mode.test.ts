/**
 * v3.8.524 — 연속발행 큐에 구글 디스커버 모드가 빠져 있었다 (사장님 보고)
 *
 * 단일 발행(contentMode)·예약 발행(scheduleContentMode) 셀렉트에는 6개 모드가 다 있는데,
 * 연속발행 큐의 일괄 변경 셀렉트(pq-bulk-mode)에만 discover·shopping 이 없었다.
 * 라벨 표(QUEUE_LABELS.contentMode)에도 discover 가 없어 큐 카드에 영문 "discover" 로 떴다.
 *
 * 이 저장소의 payload 3경로 함정(단일/큐/스케줄이 따로 조립)과 같은 무늬다 —
 * 한 곳에 모드를 추가하면 나머지 두 곳이 조용히 뒤처진다. 그래서 세 곳을 함께 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const html = read('electron/ui/index.html');
const queue = read('electron/ui/modules/publish-queue.js');

/** 실제로 앱이 제공하는 콘텐츠 모드 — 단일 발행 셀렉트가 기준이다 */
const CONTENT_MODES = ['external', 'internal', 'shopping', 'adsense', 'paraphrasing', 'discover'];

function optionValues(source: string, selectId: string): string[] {
  const start = source.indexOf(`id="${selectId}"`);
  if (start < 0) return [];
  const end = source.indexOf('</select>', start);
  const block = source.slice(start, end);
  return [...block.matchAll(/value="([^"]*)"/g)].map((m) => m[1]!).filter(Boolean);
}

describe('연속발행 큐도 단일 발행과 같은 모드를 제공한다', () => {
  it('단일 발행 셀렉트에 6개 모드가 모두 있다 (기준)', () => {
    const values = optionValues(html, 'contentMode');
    for (const mode of CONTENT_MODES) expect(values).toContain(mode);
  });

  it('예약 발행 셀렉트도 같은 모드를 제공한다', () => {
    const values = optionValues(html, 'scheduleContentMode');
    for (const mode of CONTENT_MODES) expect(values).toContain(mode);
  });

  it('연속발행 큐의 일괄 모드 변경에도 디스커버·쇼핑이 있다 — 여기만 빠져 있었다', () => {
    const values = optionValues(queue, 'pq-bulk-mode');
    expect(values).toContain('discover');
    expect(values).toContain('shopping');
    for (const mode of CONTENT_MODES) expect(values).toContain(mode);
  });

  it('큐 카드가 모드를 한글로 보여준다 — 라벨이 없으면 영문 값이 그대로 뜬다', () => {
    const labels = queue.slice(queue.indexOf('const QUEUE_LABELS'), queue.indexOf('thumb: {'));
    for (const mode of CONTENT_MODES) {
      expect(labels).toContain(`${mode}:`);
    }
    expect(labels).toContain('디스커버');
  });
});
