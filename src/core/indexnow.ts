/**
 * IndexNow API — 즉시 색인 요청
 * 한 번 호출로 Bing + Yandex + Naver에 동시 색인 요청
 */

const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

export async function submitToIndexNow(
  siteUrl: string,
  urls: string[],
  apiKey?: string
): Promise<{ ok: boolean; results: Array<{ endpoint: string; status: number }>; error?: string }> {
  // Generate a key if not provided
  const key = apiKey || generateIndexNowKey();

  // IndexNow requires a key file at {siteUrl}/{key}.txt
  // For now, just submit the API request

  const results = [];
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: new URL(siteUrl).hostname,
          key,
          keyLocation: `${siteUrl}/${key}.txt`,
          urlList: urls.slice(0, 10000) // max 10000 per request
        })
      });
      results.push({ endpoint, status: response.status });
    } catch (e: any) {
      results.push({ endpoint, status: 0 });
    }
  }

  return { ok: results.some(r => r.status >= 200 && r.status < 300), results };
}

function generateIndexNowKey(): string {
  const chars = 'abcdef0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
