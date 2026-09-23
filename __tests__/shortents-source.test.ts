import { buildShortentsPageUrl, listShortents, parseShortentsPage } from '../src/core/shortents-source';

const row = (n: number) => ({ title: `숏텐츠 키워드 ${n}`, linkUrl: `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`숏텐츠 키워드 ${n}`)}`, gdid: `90000003_item_${n}`, rank: n });

describe('public mobile Shortents snapshot', () => {
  test('collects at most five observed pages and forwards previous-page ids only', async () => {
    const getJson = jest.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('shortents_page'));
      return { contents: Array.from({ length: 4 }, (_, i) => row((page - 1) * 4 + i + 1)), keywords: null };
    });
    const out = await listShortents({ getJson, now: () => new Date('2026-09-17T09:00:00Z') });
    expect(out.items).toHaveLength(20);
    expect(getJson).toHaveBeenCalledTimes(5);
    expect(new URL(getJson.mock.calls[2]![0]).searchParams.get('shortents_list')).toBe([5, 6, 7, 8].map(n => row(n).gdid).join(','));
    expect(out.fetchedAt).toBe('2026-09-17T09:00:00.000Z');
    expect(out.sourceUrl).toBe('https://m.naver.com/');
    expect(out.scope).toContain('네이버 전체 숏텐츠를 뜻하지 않습니다');
  });

  test('stops when the service repeats a page and deduplicates by keyword', async () => {
    const getJson = jest.fn().mockResolvedValue({ contents: [row(1), row(2)] });
    const out = await listShortents({ getJson });
    expect(out.items).toHaveLength(2);
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  test('does not relabel unrelated recommendation keywords as Shortents', async () => {
    await expect(listShortents({ getJson: async () => ({ keywords: [row(1)] }) })).rejects.toThrow('응답 형식');
    await expect(listShortents({ getJson: async () => ({ contents: [] }) })).rejects.toThrow('찾지 못했습니다');
  });

  test('fails explicitly if a later page cannot be fetched', async () => {
    const getJson = jest.fn().mockResolvedValueOnce({ contents: [row(1)] }).mockRejectedValueOnce(new Error('timeout'));
    await expect(listShortents({ getJson })).rejects.toThrow('자동 수집 실패');
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  test.each(['javascript:alert(1)', 'https://m.search.naver.com.attacker.test/search.naver?query=test', 'https://m.search.naver.com/private?query=test'])('rejects unsafe/unexpected destination %s', (linkUrl) => {
    expect(() => parseShortentsPage({ contents: [{ ...row(1), linkUrl }] })).toThrow();
  });

  test('keeps the observed endpoint parameters and does not need credentials', () => {
    const url = new URL(buildShortentsPageUrl(1, []));
    expect(url.origin).toBe('https://s.search.naver.com');
    expect(url.searchParams.get('ssc')).toBe('m.recentkeyword.main');
    expect(url.searchParams.get('display_keyword')).toBe('0');
    expect(url.searchParams.get('shortents_list')).toBe('');
  });
});
