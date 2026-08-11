/**
 * v3.8.473 회귀 — 네이버 블로그 본문을 한 글자도 못 가져오던 사고.
 *
 * 실측(2026-08-11) 라이브 글 4건: 기존 추출기 0자 → 신규 1,388~3,600자.
 * 두 가지가 겹쳐 있었다.
 *   1) 선택자가 `post-content`/`postViewArea` — 현재 네이버는 `se-main-container`
 *   2) `([\s\S]*?)</div>` 비탐욕 매칭 — 중첩 div 의 첫 닫는 태그에서 끊긴다
 * 둘 다 잠근다. 하나만 고치면 여전히 몇백 자밖에 못 건진다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  extractBalancedDiv,
  extractNaverPostBody,
  DEFAULT_MAX_BODY_CHARS,
} from '../src/core/crawlers/naver-post-body';

/** 실제 SE-ONE 구조를 축약한 것 — 본문 div 안에 div 가 여러 겹 중첩된다 */
const seOnePage = `
<html><head><title>2026년 전기차 보조금 총정리</title></head><body>
  <div id="header"><div class="nav">메뉴</div></div>
  <div class="se-main-container">
    <div class="se-component se-text"><div class="se-module"><p>
      국고 보조금은 최대 650만원이고, 지자체 보조금은 지역마다 다릅니다.
      서울시는 2026년 3월 31일까지 신청을 받습니다.
    </p></div></div>
    <div class="se-component se-image"><div class="se-module"><img src="x.jpg" /></div></div>
    <div class="se-component se-text"><div class="se-module"><p>
      신청 순서는 이렇습니다. 먼저 차량 계약서를 준비하고, 저공해차 통합누리집에서
      지원 대상 차종인지 확인한 뒤, 관할 지자체에 접수하면 됩니다. 처리에는 보통
      14일 이내가 걸리고, 예산이 소진되면 접수가 조기 마감됩니다.
    </p></div></div>
  </div>
  <div class="comment-area"><div class="cmt">댓글 영역입니다</div></div>
</body></html>`;

describe('extractBalancedDiv', () => {
  it('중첩된 div 를 건너뛰고 짝이 맞는 닫는 태그까지 가져온다', () => {
    const inner = extractBalancedDiv(seOnePage, /<div[^>]*class=["'][^"']*\bse-main-container\b[^"']*["'][^>]*>/i);

    expect(inner).not.toBeNull();
    // 본문 첫 문단과 마지막 문단이 모두 살아 있어야 한다 = 중간에서 안 끊겼다
    expect(inner).toContain('국고 보조금은 최대 650만원');
    expect(inner).toContain('예산이 소진되면 접수가 조기 마감');
    // 본문 밖(댓글)은 넘어오면 안 된다
    expect(inner).not.toContain('댓글 영역입니다');
  });

  it('비탐욕 매칭이었다면 잘렸을 지점을 넘어간다 (사고 재현 잠금)', () => {
    const naive = seOnePage.match(/<div[^>]*class=["'][^"']*\bse-main-container\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const naiveText = (naive?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const balanced = extractBalancedDiv(seOnePage, /<div[^>]*class=["'][^"']*\bse-main-container\b[^"']*["'][^>]*>/i)!;

    expect(naiveText).not.toContain('조기 마감');
    expect(balanced.length).toBeGreaterThan(naiveText.length * 2);
  });

  it('해당 컨테이너가 없으면 null', () => {
    expect(extractBalancedDiv('<p>본문 없음</p>', /<div[^>]*id=["']nope["'][^>]*>/i)).toBeNull();
  });
});

describe('extractNaverPostBody', () => {
  it('스마트에디터 ONE 본문을 평문으로 뽑는다', () => {
    const body = extractNaverPostBody(seOnePage);

    expect(body).not.toBeNull();
    expect(body!.text).toContain('650만원');
    expect(body!.text).toContain('14일 이내');
    expect(body!.text).not.toContain('댓글 영역입니다');
    expect(body!.text).not.toMatch(/<[a-z]/i);
  });

  it('구버전 postViewArea 도 계속 지원한다 (후퇴 없음)', () => {
    const legacy = `<html><body><div id="postViewArea"><div><p>${'구버전 에디터 본문입니다. '.repeat(20)}</p></div></div></body></html>`;
    const body = extractNaverPostBody(legacy);

    expect(body).not.toBeNull();
    expect(body!.text).toContain('구버전 에디터 본문입니다');
  });

  it('편당 글자수를 제한해 여러 편의 재료 폭을 지킨다', () => {
    const long = `<html><body><div class="se-main-container"><p>${'가나다라마바사아자차 '.repeat(2000)}</p></div></body></html>`;
    const body = extractNaverPostBody(long);

    expect(body!.rawLength).toBeGreaterThan(DEFAULT_MAX_BODY_CHARS);
    expect(body!.text.length).toBe(DEFAULT_MAX_BODY_CHARS);
  });

  it('본문 컨테이너가 없으면 null — 호출부가 API description 으로 폴백한다', () => {
    expect(extractNaverPostBody('<html><body><div class="sidebar">광고</div></body></html>')).toBeNull();
    expect(extractNaverPostBody('')).toBeNull();
  });
});

describe('크롤러 배선', () => {
  it('content-crawler 가 죽은 선택자 대신 신규 추출기를 쓴다', () => {
    const crawler = readFileSync(join(__dirname, '..', 'src/core/content-crawler.ts'), 'utf8');
    const branchStart = crawler.indexOf("if (platform === 'naver')");
    // 네이버 분기만 본다 — 그 뒤 else 는 타 플랫폼용이라 이번 수정 범위가 아니다
    const naverBranch = crawler.slice(branchStart, crawler.indexOf('} else {', branchStart));

    expect(naverBranch).toContain('extractNaverPostBody');
    // 사고를 일으킨 인라인 정규식(죽은 선택자 + 비탐욕 매칭)이 되살아나지 않게 잠근다
    expect(naverBranch).not.toContain('html.match(');
  });
});
