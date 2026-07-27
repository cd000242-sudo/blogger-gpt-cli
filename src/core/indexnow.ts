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
): Promise<{ ok: boolean; results: Array<{ endpoint: string; status: number }>; error?: string; skipped?: boolean }> {
  // v3.8.376: 키 파일 없이 보내는 요청은 소유권 검증에서 반드시 탈락한다.
  //   기존에는 매 호출 랜덤 키를 만들어 전송했고(키 파일은 어디에도 업로드 안 됨) 2xx 응답을
  //   '성공'으로 로그했지만 실제 색인은 한 번도 되지 않았다. 정직하게 스킵하고 이유를 남긴다.
  //   (워드프레스는 Instant Indexing 플러그인이 IndexNow를 정상 처리 중이므로 실질 손실 없음)
  if (!apiKey) {
    console.log('[INDEXNOW] ⏭️ 스킵 — API 키/키 파일 미설정 (사이트 루트에 {key}.txt 업로드 후 키를 전달해야 유효)');
    return { ok: false, skipped: true, results: [], error: 'IndexNow key not provisioned — skipped (no-op request avoided)' };
  }
  const key = apiKey;

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

// v3.8.376: generateIndexNowKey 제거 — 랜덤 키는 소유권 검증을 통과할 수 없어 무의미했다.
// 유효한 키를 쓰려면 사이트 루트에 {key}.txt를 업로드하고 apiKey 인자로 전달해야 한다.
