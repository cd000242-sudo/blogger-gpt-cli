/**
 * v3.8.773 - Dropshot: login and ready checks pass, but generation ends with "210초 내 결과 이미지 미발견"
 *
 * Live evidence (2026-11-12, hidden background browser, run through dist/core/dropshotGenerator.js):
 *   - POST api.aistudio.dropshot.io/v1/job/google%2Fnano-banana-pro -> 201, the board moved to /board/<id>.
 *   - ~30 s later the result was on screen (screenshot F:\work\orbit-release\ds_gen\g1_final_c0p0.png), 2816x1536 PNG.
 *   - The app kept polling for 210 s and found nothing.
 * Root cause: the site now serves every picture through its own resizing endpoint
 *     https://aistudio.dropshot.io/api/media/image?src=<encoded cdn address>&w=384
 *   (the old build used https://img.aistudio.dropshot.io/.../jobs/.../output_0.jpg directly). The candidate filter required
 *   "/jobs/" in the pathname of the <img> address, which is now always "/api/media/image", so the finished result was rejected.
 */
import { findDropshotResultDataUrl, isOwnDropshotResultCandidate, type DropshotRawImageCandidate } from '../src/core/dropshotGenerator';
import { isDropshotJobResultAddress } from '../src/core/dropshotResultAddress';

const proxied = (inner: string, w = 384): string =>
  `https://aistudio.dropshot.io/api/media/image?src=${encodeURIComponent(inner)}&w=${w}`;

// Shapes measured on the live board (job ids shortened).
const JOB_INNER = 'https://cdn.aistudio.dropshot.io/public/jobs/prod/-P6DASm61X1Hp_gpIR0a/output/output_0.png';
const LOGO_INNER = 'https://cdn.aistudio.dropshot.io/public/icons/ic_studio_logo-v2.svg';
const BANNER_INNER = 'https://cdn.aistudio.dropshot.io/public/home/banner/264q_avatar2_179.png';

const base: DropshotRawImageCandidate = {
  src: proxied(JOB_INNER), width: 320, height: 174, renderedWidth: 252, renderedHeight: 252, kind: 'img', inJobList: false, inDialog: false,
};

describe('isDropshotJobResultAddress', () => {
  test('proxied job result (the shape the live board uses now) is a result', () => {
    expect(isDropshotJobResultAddress(proxied(JOB_INNER))).toBe(true);
    expect(isDropshotJobResultAddress(proxied(JOB_INNER, 256))).toBe(true);
  });

  test('direct job address (older site build) is still a result', () => {
    expect(isDropshotJobResultAddress('https://img.aistudio.dropshot.io/v1/aistudio-cdn/primary/public/jobs/prod/-Oyn/output/output_0.jpg?w=1920&q=75')).toBe(true);
  });

  test('proxied logo, banner and sample pictures are not results', () => {
    expect(isDropshotJobResultAddress(proxied(LOGO_INNER, 128))).toBe(false);
    expect(isDropshotJobResultAddress(proxied(BANNER_INNER))).toBe(false);
    expect(isDropshotJobResultAddress(proxied('https://cdn.aistudio.dropshot.io/public/images/character/model_01.png'))).toBe(false);
  });

  test('the proxy must point at a dropshot address - a foreign "/jobs/" address is not a result', () => {
    expect(isDropshotJobResultAddress(proxied('https://evil.example.com/public/jobs/prod/x/output_0.png'))).toBe(false);
    expect(isDropshotJobResultAddress('https://evil.example.com/api/media/image?src=' + encodeURIComponent(JOB_INNER))).toBe(false);
  });

  test('a proxy address without a src, or with a garbage src, is not a result', () => {
    expect(isDropshotJobResultAddress('https://aistudio.dropshot.io/api/media/image?w=384')).toBe(false);
    expect(isDropshotJobResultAddress('https://aistudio.dropshot.io/api/media/image?src=%%%&w=384')).toBe(false);
  });

  test('not an address at all', () => {
    expect(isDropshotJobResultAddress('')).toBe(false);
    expect(isDropshotJobResultAddress('not a url')).toBe(false);
    expect(isDropshotJobResultAddress('https://aistudio.dropshot.io/ko/workspace/board')).toBe(false);
  });
});

describe('isOwnDropshotResultCandidate with the proxied address', () => {
  test('the finished result in the middle of the board is accepted (this was rejected for 210 s)', () => {
    expect(isOwnDropshotResultCandidate(base)).toBe(true);
  });

  test('a proxied job thumbnail in the left "내 작업" list is still rejected', () => {
    expect(isOwnDropshotResultCandidate({ ...base, renderedWidth: 32, renderedHeight: 32, inJobList: true })).toBe(false);
    expect(isOwnDropshotResultCandidate({ ...base, inJobList: true })).toBe(false);
  });

  test('a proxied job picture inside a pop-up is still rejected', () => {
    expect(isOwnDropshotResultCandidate({ ...base, inDialog: true })).toBe(false);
  });

  test('proxied logo / banner shown big are still rejected', () => {
    expect(isOwnDropshotResultCandidate({ ...base, src: proxied(BANNER_INNER), renderedWidth: 560, renderedHeight: 315 })).toBe(false);
    expect(isOwnDropshotResultCandidate({ ...base, src: proxied(LOGO_INNER, 128), renderedWidth: 110, renderedHeight: 18 })).toBe(false);
  });
});

describe('findDropshotResultDataUrl on the live board shape', () => {
  const PNG_BYTES = Buffer.alloc(30_000, 7);

  function fakePage(raw: DropshotRawImageCandidate[]) {
    const requested: string[] = [];
    const page: any = {
      // First evaluate() collects the candidates (arg = list of known addresses); the second is the in-page download,
      // which the live site refuses for the proxy address ("Failed to fetch") - so the browser-context request must be used.
      evaluate: jest.fn(async (_fn: unknown, arg: unknown) => {
        if (Array.isArray(arg)) return raw;
        throw new Error('Failed to fetch');
      }),
      context: () => ({
        request: {
          get: async (url: string) => {
            requested.push(url);
            return { ok: () => true, headers: () => ({ 'content-type': 'image/png' }), body: async () => PNG_BYTES };
          },
        },
      }),
    };
    return { page, requested };
  }

  test('returns the result picture as a data URL', async () => {
    const logo: DropshotRawImageCandidate = { ...base, src: proxied(LOGO_INNER, 128), renderedWidth: 110, renderedHeight: 18 };
    const { page, requested } = fakePage([logo, base]);
    const dataUrl = await findDropshotResultDataUrl(page, []);
    expect(dataUrl).not.toBeNull();
    expect(dataUrl!.startsWith('data:image/png;base64,')).toBe(true);
    expect(requested).toEqual([base.src]);
  });

  test('nothing but logo and banners on the board -> still no result (no false positive)', async () => {
    const { page } = fakePage([
      { ...base, src: proxied(LOGO_INNER, 128), renderedWidth: 110, renderedHeight: 18 },
      { ...base, src: proxied(BANNER_INNER), renderedWidth: 560, renderedHeight: 315 },
    ]);
    await expect(findDropshotResultDataUrl(page, [])).resolves.toBeNull();
  });
});
