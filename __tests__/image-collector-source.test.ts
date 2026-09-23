/**
 * image-collector 원본 복원 (2026-09-23)
 *
 * 왜: 반자동 모드의 이미지 수집(제목·쇼핑 URL → 폴더 저장)이 쓰는 dist/image-collector.js 는
 *   원본(src)이 저장소에 한 번도 없던 4월 산출물이었다. 6월에 맥 빌드를 살리려고 산출물 자체를
 *   커밋했고, dist 를 지우고 새로 빌드하면 electron/main.ts 가 TS2307 로 멈췄다
 *   (v3.8.749 릴리스 때 실제로 멈춰 메인 폴더의 옛 파일을 복사해 넘겼다).
 *
 * 무엇을 막나:
 *   1) electron 이 부르는 ../dist 모듈은 전부 src 에 원본이 있어야 한다 — 산출물만 있는 모듈 금지
 *   2) 되살린 원본이 출시본과 같은 동작을 한다 — 점수 매기기·쇼핑몰 파싱·폴더 목록·네이버 응답 변환
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  collectImagesByTitle,
  collectImagesFromShoppingUrl,
  crawlShoppingUrl,
  deleteImageFolder,
  getImageFolders,
  getImagesFromFolder,
  matchImagesToSubtopics,
  searchNaverImages,
  searchNaverShopping,
  type CollectedImage,
} from '../src/image-collector';

const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { get: (...args: unknown[]) => mockAxiosGet(...args) } }));

// 수집 폴더는 userData/collected-images — 실제 APPDATA 대신 임시 폴더를 쓴다
const mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'image-collector-'));
jest.mock('electron', () => ({ app: { getPath: () => mockUserData } }));

const ROOT = path.join(__dirname, '..');
const STORAGE = path.join(mockUserData, 'collected-images');

afterAll(() => {
  fs.rmSync(mockUserData, { recursive: true, force: true });
});

beforeEach(() => {
  mockAxiosGet.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('electron 이 부르는 ../dist 모듈에는 원본이 있다', () => {
  function distSpecifiers(): string[] {
    const electronDir = path.join(ROOT, 'electron');
    const specs = new Set<string>();
    for (const file of fs.readdirSync(electronDir)) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
      const text = fs.readFileSync(path.join(electronDir, file), 'utf8');
      const re = /(?:require|import)\(\s*['"](\.\.\/dist\/[^'"]+)['"]\s*\)|from\s+['"](\.\.\/dist\/[^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) specs.add((m[1] || m[2]) as string);
    }
    return [...specs];
  }

  function hasSource(spec: string): boolean {
    const rel = spec.replace(/^\.\.\/dist\//, '').replace(/\.js$/, '');
    return [`${rel}.ts`, `${rel}.js`, `${rel}/index.ts`, `${rel}/index.js`]
      .some((candidate) => fs.existsSync(path.join(ROOT, 'src', candidate)));
  }

  it('검사기가 실제로 ../dist 경로를 찾는다 (0개면 검사기 고장)', () => {
    const specs = distSpecifiers();
    expect(specs.length).toBeGreaterThan(50);
    expect(specs).toContain('../dist/image-collector.js');
  });

  it('원본 없는 산출물이 하나도 없다', () => {
    expect(distSpecifiers().filter((spec) => !hasSource(spec))).toEqual([]);
  });
});

describe('matchImagesToSubtopics — 출시본 점수 규칙 그대로', () => {
  const images: CollectedImage[] = [
    { url: 'a', title: '무선 청소기 비교', source: 'naver-image', keyword: '청소기', width: 1000, height: 700 },
    { url: 'b', title: '청소기', source: 'naver-shopping', keyword: '가전', relevanceScore: 98 },
    { url: 'c', title: '로봇', source: 'coupang', keyword: '로봇' },
  ];

  it('제목 +20 · 검색어 +15 · 큰 이미지 +10/+10 · 쇼핑 +5 로 점수를 매겨 높은 순으로 고른다', () => {
    const [match] = matchImagesToSubtopics(['무선 청소기 추천!'], images);
    expect(match?.subtopic).toBe('무선 청소기 추천!');
    // a: 50 + 20(무선) + 20(청소기) + 15(검색어 청소기) + 10 + 10 = 125
    // b: 98 + 20(청소기) + 5(쇼핑) = 123 · c: 50 + 5(쿠팡) = 55
    expect(match?.images.map((img) => [img.url, img.relevanceScore])).toEqual([['a', 125], ['b', 123], ['c', 55]]);
    expect(match?.selectedImage?.url).toBe('a');
  });

  it('원본 이미지 객체는 바꾸지 않는다', () => {
    matchImagesToSubtopics(['무선 청소기'], images);
    expect(images[0]?.relevanceScore).toBeUndefined();
    expect(images[1]?.relevanceScore).toBe(98);
  });

  it('이미지가 없으면 소제목만 돌려주고 선택 이미지는 없다', () => {
    expect(matchImagesToSubtopics(['아무거나'], [])).toEqual([{ subtopic: '아무거나', images: [], selectedImage: undefined }]);
  });
});

describe('crawlShoppingUrl — 쇼핑몰 페이지에서 상품 이미지 뽑기', () => {
  const html = `<html><head><title>스탠드 선풍기 - 쿠팡 | 로켓배송</title>
    <meta property="og:image" content="https://img.example.com/og.jpg"></head><body>
    <img src="//thumbnail.coupangcdn.com/product/main.jpg" alt="선풍기 정면">
    <img src="/images/product/side.png">
    <img src="https://static.example.com/product/icon-star.png">
    <img src="https://static.example.com/product/tiny.jpg" width="50">
    <img src="//thumbnail.coupangcdn.com/product/main.jpg">
    <img src="https://static.example.com/product/noext">
  </body></html>`;

  it('대표(og) 이미지를 맨 앞에, 상대·프로토콜 생략 주소를 절대 주소로, 아이콘·작은 것·중복·확장자 없는 것은 뺀다', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: html });
    const images = await crawlShoppingUrl('https://www.coupang.com/vp/products/123');
    expect(images).toEqual([
      { url: 'https://img.example.com/og.jpg', title: '스탠드 선풍기 (대표)', source: 'coupang', keyword: '스탠드 선풍기', relevanceScore: 100 },
      { url: 'https://thumbnail.coupangcdn.com/product/main.jpg', title: '선풍기 정면', source: 'coupang', keyword: '스탠드 선풍기' },
      { url: 'https://www.coupang.com/images/product/side.png', title: '스탠드 선풍기', source: 'coupang', keyword: '스탠드 선풍기' },
    ]);
  });

  it('페이지를 못 받으면 빈 목록', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('timeout'));
    await expect(crawlShoppingUrl('https://shop.example.com/p/1')).resolves.toEqual([]);
  });

  it('쇼핑 URL 에서 이미지를 하나도 못 찾으면 실패로 알린다', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: '<html><head><title>빈 페이지</title></head><body></body></html>' });
    await expect(collectImagesFromShoppingUrl('https://shop.example.com/p/2', ['소제목'], { saveToFolder: false }))
      .resolves.toEqual({ ok: false, images: [], folderPath: '', error: '이미지를 찾을 수 없습니다' });
  });
});

describe('네이버 검색 응답 변환', () => {
  it('이미지 검색: 태그를 벗기고 크기를 숫자로, 제목이 비면 번호 이름', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        items: [
          { link: 'https://x.example/1.jpg', title: '<b>제주</b> 바다', sizewidth: '1200', sizeheight: '800' },
          { link: 'https://x.example/2.jpg', title: '', sizewidth: '', sizeheight: '' },
        ],
      },
    });
    const images = await searchNaverImages('제주', 'id', 'secret');
    expect(images).toEqual([
      { url: 'https://x.example/1.jpg', title: '제주 바다', source: 'naver-image', keyword: '제주', width: 1200, height: 800 },
      { url: 'https://x.example/2.jpg', title: '이미지_2', source: 'naver-image', keyword: '제주', width: undefined, height: undefined },
    ]);
    const [url, config] = mockAxiosGet.mock.calls[0] as [string, { params: unknown; headers: Record<string, string> }];
    expect(url).toBe('https://openapi.naver.com/v1/search/image');
    expect(config.params).toEqual({ query: '제주', display: 20, filter: 'large', sort: 'sim' });
    expect(config.headers).toEqual({ 'X-Naver-Client-Id': 'id', 'X-Naver-Client-Secret': 'secret' });
  });

  it('쇼핑 검색: 순서대로 100·98 점, 제목이 없으면 상품 번호 이름', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { items: [{ image: 'https://s.example/1.jpg', title: '<b>선풍기</b>' }, { image: 'https://s.example/2.jpg' }] } });
    const images = await searchNaverShopping('선풍기', 'id', 'secret');
    expect(images).toEqual([
      { url: 'https://s.example/1.jpg', title: '선풍기', source: 'naver-shopping', keyword: '선풍기', relevanceScore: 100 },
      { url: 'https://s.example/2.jpg', title: '상품_2', source: 'naver-shopping', keyword: '선풍기', relevanceScore: 98 },
    ]);
  });

  it('검색이 실패하면 빈 목록 (예외를 던지지 않는다)', async () => {
    mockAxiosGet.mockRejectedValue(new Error('401'));
    await expect(searchNaverImages('a', 'id', 'secret')).resolves.toEqual([]);
    await expect(searchNaverShopping('a', 'id', 'secret')).resolves.toEqual([]);
  });
});

describe('collectImagesByTitle — 제목·소제목으로 모아 폴더에 저장', () => {
  it('제목·쇼핑·소제목(번호·물음표 제거) 순으로 검색하고, 중복 주소는 한 번만, 소제목마다 점수 1위를 고른다', async () => {
    mockAxiosGet.mockImplementation(async (url: string, config: { params?: { query: string }; responseType?: string }) => {
      if (config?.responseType === 'arraybuffer') return { data: Buffer.from('img'), headers: { 'content-type': 'image/png' } };
      const query = config?.params?.query;
      if (url.endsWith('/image')) return { data: { items: [{ link: `https://img.example/${query}.jpg`, title: String(query) }, { link: 'https://img.example/shared.jpg', title: '공통' }] } };
      return { data: { items: [{ image: 'https://shop.example/p.jpg', title: '상품' }] } };
    });

    const result = await collectImagesByTitle('여름 가전', ['1. 탁상 선풍기?', '벽걸이'], 'id', 'secret', { maxImagesPerSubtopic: 1 });

    const queries = mockAxiosGet.mock.calls
      .filter(([, config]) => config?.params)
      .map(([url, config]) => `${String(url).split('/').pop()}:${config.params.query}:${config.params.display}`);
    expect(queries).toEqual(['image:여름 가전:30', 'shop:여름 가전:20', 'image:탁상 선풍기:10', 'image:벽걸이:10']);

    // 탁상 선풍기: 50 + 제목 20·20 + 검색어 15·15 = 120 > 쇼핑 105
    // 벽걸이: 쇼핑 상품이 기본 100 + 5 = 105 로 벽걸이 사진(85)을 이긴다 — 출시본 그대로의 점수 규칙
    expect(result.ok).toBe(true);
    expect(result.images.map((img) => img.url)).toEqual(['https://img.example/탁상 선풍기.jpg', 'https://shop.example/p.jpg']);

    // 폴더 이름은 날짜_제목, 파일 이름에 못 쓰는 ? 는 _, 확장자는 응답 형식(png)을 따른다
    expect(path.dirname(result.folderPath)).toBe(STORAGE);
    expect(path.basename(result.folderPath)).toMatch(/^\d{4}-\d{2}-\d{2}_여름 가전$/);
    expect(fs.readdirSync(result.folderPath).sort()).toEqual(['1. 탁상 선풍기__1.png', '벽걸이_1.png']);
    expect(result.images.every((img) => img.localPath && fs.existsSync(img.localPath))).toBe(true);
  });
});

describe('수집 폴더 목록·열기·지우기', () => {
  beforeAll(() => {
    // 위 테스트가 만든 오늘 날짜 폴더와 섞이지 않게 지난 날짜로 만든다
    for (const [folder, files] of [['2001-01-01_가', ['a.jpg', 'b.PNG', 'memo.txt']], ['2001-01-20_나', ['c.webp']]] as const) {
      fs.mkdirSync(path.join(STORAGE, folder), { recursive: true });
      for (const file of files) fs.writeFileSync(path.join(STORAGE, folder, file), 'x');
    }
    fs.writeFileSync(path.join(STORAGE, 'loose.jpg'), 'x');
  });

  it('폴더만 최신 이름순으로, 이미지 개수는 이미지 확장자만 센다', () => {
    const folders = getImageFolders().filter((f) => f.name.startsWith('2001-'));
    expect(folders).toEqual([
      { name: '2001-01-20_나', path: path.join(STORAGE, '2001-01-20_나'), imageCount: 1 },
      { name: '2001-01-01_가', path: path.join(STORAGE, '2001-01-01_가'), imageCount: 2 },
    ]);
    expect(getImageFolders().map((f) => f.name)).not.toContain('loose.jpg');
  });

  it('폴더 안 이미지 목록 (없는 폴더는 빈 목록)', () => {
    const folder = path.join(STORAGE, '2001-01-01_가');
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect(getImagesFromFolder(folder).sort(byName)).toEqual([
      { path: path.join(folder, 'a.jpg'), name: 'a.jpg' },
      { path: path.join(folder, 'b.PNG'), name: 'b.PNG' },
    ]);
    expect(getImagesFromFolder(path.join(STORAGE, '없는 폴더'))).toEqual([]);
  });

  it('수집 폴더를 지우면 true, 이미 없으면 false', () => {
    const folder = path.join(STORAGE, '2001-01-20_나');
    expect(deleteImageFolder(folder)).toBe(true);
    expect(fs.existsSync(folder)).toBe(false);
    expect(deleteImageFolder(folder)).toBe(false);
  });
});
