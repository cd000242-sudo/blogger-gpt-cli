/**
 * 앱 시작 속도 — 무거운 라이브러리는 쓸 때 불러온다 (v3.8.498)
 *
 * 실측(2026-08-14): puppeteer-extra 353ms · cheerio 354ms · stealth 16ms = 723ms.
 * 셋 다 electron/main.ts 최상위 import 였어서 앱을 켤 때마다 창이 뜨기 전에
 * 0.7초를 먹었다. puppeteer 는 브라우저를 띄울 때, cheerio 는 HTML 을 파싱할 때만
 * 필요하고 전부 함수 안에서 쓰인다.
 *
 * 이 테스트는 누가 다시 최상위 import 로 되돌리면 잡아낸다.
 */
import * as fs from 'fs';
import * as path from 'path';

const MAIN_TS = path.join(__dirname, '..', 'electron', 'main.ts');
const source = fs.readFileSync(MAIN_TS, 'utf-8');

/** 여는 표식부터 닫는 표식까지 통째로 집는다 (고정 길이 슬라이스 금지) */
function blockBetween(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  if (from < 0) return '';
  const to = text.indexOf(end, from + start.length);
  return to < 0 ? text.slice(from) : text.slice(from, to);
}

/** 파일 맨 위의 import 구역만 (함수 안의 require 는 제외) */
const importArea = blockBetween(source, 'import { ipcMain', 'app.whenReady');

describe('무거운 라이브러리가 시작 경로에 없다', () => {
  it('puppeteer-extra 를 최상위에서 import 하지 않는다', () => {
    expect(source).not.toMatch(/^import\s+puppeteer\s+from\s+['"]puppeteer-extra['"]/m);
  });

  it('스텔스 플러그인을 최상위에서 import 하지 않는다', () => {
    expect(source).not.toMatch(/^import\s+StealthPlugin\s+from\s+['"]puppeteer-extra-plugin-stealth['"]/m);
  });

  it('cheerio 를 최상위에서 import 하지 않는다', () => {
    expect(source).not.toMatch(/^import\s+\*\s+as\s+cheerio\s+from\s+['"]cheerio['"]/m);
  });
});

describe('지연 로더가 있고 실제로 쓰인다', () => {
  it('getPuppeteer / getCheerio 가 정의돼 있다', () => {
    expect(source).toMatch(/function getPuppeteer\(\)/);
    expect(source).toMatch(/function getCheerio\(\)/);
  });

  it('스텔스 플러그인은 getPuppeteer 안에서 한 번만 끼운다', () => {
    const body = blockBetween(source, 'function getPuppeteer()', 'function getCheerio()');
    expect(body).toContain('puppeteer-extra-plugin-stealth');
    // 캐시가 있어야 매번 다시 끼우지 않는다
    expect(body).toMatch(/if \(!_puppeteer\)/);
  });

  it('cheerio 로더도 캐시한다', () => {
    const body = blockBetween(source, 'function getCheerio()', '\n}');
    expect(body).toMatch(/if \(!_cheerio\)/);
  });

  it('cheerio.load 를 직접 부르는 곳이 남아 있지 않다', () => {
    const direct = source.match(/(?<!get)(?<!\w)cheerio\.load\(/g) || [];
    expect(direct).toHaveLength(0);
  });

  it('puppeteer 를 쓰는 곳은 getPuppeteer() 로 받는다', () => {
    expect(source).toMatch(/const puppeteer = getPuppeteer\(\)/);
  });
});

describe('시작 경로에 남은 최상위 import 는 가벼운 것뿐이다', () => {
  it('electron·path·fs 만 외부 모듈로 최상위에 남는다', () => {
    const external = [...importArea.matchAll(/^import .*? from '([^.'][^']*)'/gm)]
      .map((m) => String(m[1] || ''))
      .filter((name) => name && !name.startsWith('.'));
    const heavy = external.filter((name) => /puppeteer|cheerio|playwright|sharp/.test(name));
    expect(heavy).toEqual([]);
  });
});
