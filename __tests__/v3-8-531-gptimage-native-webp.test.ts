/**
 * GPT이미지 네이티브 WebP 테스트 (v3.8.531)
 *
 * 배경: 기존엔 PNG(사진형 1024² ≈ 3MB)로 받아 발행 직전 sharp 로 WebP 재압축했다
 * (v3.8.465). gpt-image 계열은 output_format 을 지원하므로 처음부터 WebP 로 받으면
 * 이중 인코딩(화질 손실)·변환 CPU·전송량이 사라진다.
 *
 * 안전선: 파라미터를 모르는 모델이 400 을 주면 output_format 없이 1회 재시도 —
 * **생성이 막히면 안 된다.** 이 테스트가 세 갈래(성공/거부 복귀/무관한 400)를 잠근다.
 */
import { makeGptImageThumbnail } from '../src/thumbnail';

const realFetch = global.fetch;

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  } as unknown as Response;
}

function errorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => text,
    headers: { get: () => null },
  } as unknown as Response;
}

describe('makeGptImageThumbnail — 네이티브 WebP (v3.8.531)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  afterAll(() => {
    (global as any).fetch = realFetch;
  });

  const OPTS = { modelId: 'gpt-image-1', apiKey: 'sk-test-DUMMY-1234567890' } as any;

  test('요청 body 에 output_format=webp 가 실리고, 성공 시 dataUrl mime 도 webp', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ b64_json: 'QUJD' }] }));

    const r = await makeGptImageThumbnail('제목', '주제', OPTS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.output_format).toBe('webp');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
  });

  test('모델이 output_format 을 거부(400)하면 파라미터 없이 재시도하고 PNG 로 돌아간다 — 생성이 막히지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(400, "Unknown parameter: 'output_format'."))
      .mockResolvedValueOnce(jsonResponse({ data: [{ b64_json: 'QUJD' }] }));

    const r = await makeGptImageThumbnail('제목', '주제', OPTS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect('output_format' in retryBody).toBe(false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('output_format 과 무관한 400 은 재시도하지 않고 기존 오류 흐름 그대로', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, 'Your request was rejected by the safety system.'));

    const r = await makeGptImageThumbnail('제목', '주제', OPTS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('OPENAI_HTTP_400');
  });

  test('URL 응답 다운로드 경로는 서버 content-type 을 따른다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'https://example.com/img' }] }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        headers: { get: (k: string) => (k === 'content-type' ? 'image/webp' : null) },
      } as unknown as Response);

    const r = await makeGptImageThumbnail('제목', '주제', OPTS);

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
  });
});
