// 🔧 외부유입 링크 모듈
import { debugLog } from './core.js';

// 외부유입 링크 데이터
export const externalLinksData = {
  'A등급': [
    { name: '루리웹', url: 'https://bbs.ruliweb.com' },
    { name: '어미새', url: 'https://eomisae.co.kr/' },
    { name: '와이고수', url: 'https://ygosu.com/' },
    { name: '개그집합소', url: 'https://gezip.net/' },
    { name: '사커라인', url: 'https://soccerline.kr/' },
    { name: '이토랜드', url: 'https://www.etoland.co.kr/bbs/board.php?bo_table=etoboard02&sca=%C8%B8%BF%F8%B0%D4%BD%C3%C6%C7' },
    { name: '보드나라', url: 'https://www.bodnara.co.kr/community/index.html' },
    { name: '2cpu', url: 'http://www.2cpu.co.kr/' },
    { name: '82COOK', url: 'https://www.82cook.com/entiz/enti.php?bn=15' },
    { name: '아하', url: 'https://www.a-ha.io/' },
    { name: '월척 커뮤니티', url: 'https://www.wolchuck.co.kr/bbs/bbs/board.php?bo_table=freebd' },
    { name: '팝코', url: 'https://www.popco.net/zboard/zboard.php?id=com_freeboard' },
    { name: '실용오디오', url: 'https://www.enjoyaudio.com/zbxe/index.php?mid=freeboard' },
    { name: '헝그리보더', url: 'http://www.hungryboarder.com/index.php?mid=Free' },
    { name: '시애틀교차로', url: 'https://wowseattle.com/wow-category/free-talk/' },
    { name: '딴지 자유게시판', url: 'http://www.ddanzi.com/free' },
    { name: '서브쓰리닷컴', url: 'http://www.sub-3.com/g5/bbs/board.php?bo_table=tb_comm_free' },
    { name: '샌프란시스코 한인게시판', url: 'https://www.sfkorean.com/bbs/board.php?bo_table=logfree' },
    { name: '배틀페이지', url: 'https://v12.battlepage.com/??=Board.ETC.Table' },
    { name: '디시인사이드', url: 'https://www.dcinside.com' },
    { name: '에펨코리아', url: 'https://www.fmkorea.com' },
    { name: '더쿠', url: 'https://theqoo.net' },
    { name: '뽐뿌', url: 'https://www.ppomppu.co.kr' },
    { name: '도탁스', url: 'https://www.dotax.com' },
    { name: '아카라이브', url: 'https://arca.live' },
    { name: '개드립', url: 'https://www.dogdrip.net' }
  ],
  'A등급 네이버카페': [
    { name: '노래하는코트', url: 'https://cafe.naver.com/tsoul7' },
    { name: '딜공', url: 'https://cafe.naver.com/nyblog' },
    { name: '패밀리세일', url: 'https://cafe.naver.com/famsale', note: '출생연도 가입제한' },
    { name: '디젤매니아', url: 'https://cafe.naver.com/dieselmania', note: '출생연도 가입제한' },
    { name: '고아캐드', url: 'https://cafe.naver.com/casuallydressed', note: '출생연도 가입제한' },
    { name: '일그란데', url: 'https://cafe.naver.com/ilgrande' },
    { name: '태사랑', url: 'https://cafe.naver.com/taesarang' },
    { name: '샤오미스토리', url: 'https://cafe.naver.com/xst' },
    { name: '퍼펙트샤인', url: 'https://cafe.naver.com/perfectshine' },
    { name: '컬처블룸', url: 'https://cafe.naver.com/culturebloom' },
    { name: '스타벅스 가십', url: 'https://cafe.naver.com/starbucksgossip', note: '출생연도 가입제한' },
    { name: '키토제닉', url: 'https://cafe.naver.com/ketogenic' },
    { name: '산사모', url: 'https://cafe.naver.com/sanbonatpnetwork', note: '출생연도 가입제한' },
    { name: '디밸로이드', url: 'https://cafe.naver.com/develoid' },
    { name: '칸타타', url: 'https://cafe.naver.com/khantata' },
    { name: '김해줌마렐라', url: 'https://cafe.naver.com/gimhaezumma' },
    { name: '마포에서 아이키우기', url: 'https://cafe.naver.com/mapomommy', note: '출생연도 가입제한' },
    { name: '미사맘', url: 'https://cafe.naver.com/ira111', note: '여자만 가입가능' },
    { name: '(용인)수지맘', url: 'https://cafe.naver.com/sujilovemom', note: '여자만 가입가능' },
    { name: '클린 노원맘스토리', url: 'https://cafe.naver.com/nowonmams' },
    { name: '영동여우맘', url: 'https://cafe.naver.com/yeongdongmom', note: '여자만 가입가능' }
  ],
  'B등급': [
    { name: '낚시사랑', url: 'https://www.fishnet.co.kr/' },
    { name: 'NBA 매니아', url: 'https://mania.kr/' },
    { name: '골프야놀자', url: 'https://www.golfyanolja.com/' },
    { name: '세연넷', url: 'https://www.seiyon.net/', note: '연세대만 가입가능' },
    { name: '스누라이프', url: 'https://snulife.com/', note: '서울대만 가입가능' },
    { name: '보배드림', url: 'https://www.bobaedream.co.kr/' },
    { name: '고파스', url: 'https://www.koreapas.com/bbs/main.php' },
    { name: '네이버뿜', url: 'https://m.bboom.naver.com/best/list' },
    { name: '오르비', url: 'https://orbi.kr/' },
    { name: '퀘이사존', url: 'https://quasarzone.com/' },
    { name: 'MLB PARK', url: 'http://mlbpark.donga.com/mp/b.php?p=1&m=list&b=mlbtown&query=&select=&user=' },
    { name: '알지롱', url: 'https://te31.com/rgr/main.php' },
    { name: '설', url: 'https://sir.kr/g5_tip' },
    { name: 'OKKY', url: 'https://okky.kr/' },
    { name: '해연갤', url: 'https://hygall.com/' },
    { name: '기글하드웨어', url: 'https://gigglehd.com/gg/bbs' },
    { name: '다나와', url: 'http://pc26.danawa.com/bbs/?controller=board&methods=getBoardList&boardSeq=298#1' },
    { name: '필름메이커스', url: 'https://www.filmmakers.co.kr/board' },
    { name: '시애틀코리아한인커뮤', url: 'https://www.seattlekorea.com/community/index' },
    { name: '색소폰나라', url: 'http://saxophonenara.net/bbs/board.php?bo_table=free¤tId=2' },
    { name: 'EVAPE', url: 'https://evape.kr/bbs/board.php?bo_table=free' },
    { name: '해시넷', url: 'http://hash.kr/community/free/list.htm' },
    { name: '아이보스', url: 'https://www.i-boss.co.kr/ab-1486504' },
    { name: '듀나의 영화게시판', url: 'http://www.djuna.kr/xe/' },
    { name: '태요넷', url: 'http://www.taeyo.net/' },
    { name: '셀클럽', url: 'http://sellclub.co.kr/community/index.php' },
    { name: '미니기기 코리아', url: 'https://meeco.kr' },
    { name: '마미톡', url: 'https://mmtalk.kr/', note: '모바일전용' },
    { name: '담소', url: 'https://play.google.com/store/apps/details?id=com.zamongstudio.bandal', note: '모바일전용' }
  ],
  'B등급 네이버카페': [
    { name: 'PS5 공식플레이카페', url: 'https://cafe.naver.com/playps4' },
    { name: '몰테일', url: 'https://cafe.naver.com/malltail' },
    { name: '쇼핑지름신', url: 'https://cafe.naver.com/shopjirmsin' },
    { name: '쇼핑매니아', url: 'https://cafe.naver.com/hotdealcommunity' },
    { name: '스마트바겐', url: 'https://cafe.naver.com/smartbargain' },
    { name: '진희맘홀릭', url: 'https://cafe.naver.com/jinheemom', note: '여자만 가입가능' },
    { name: '어디든 체크인', url: 'https://cafe.naver.com/checkincafe' },
    { name: '마이로프트', url: 'https://cafe.naver.com/2myloft' },
    { name: '짱구대디', url: 'https://cafe.naver.com/zzang9daddy' },
    { name: '브랜디드', url: 'https://cafe.naver.com/coredenim', note: '남자만 가입가능' },
    { name: '캠핑퍼스트', url: 'https://cafe.naver.com/campingfirst' },
    { name: '싱가폴 사랑', url: 'https://cafe.naver.com/singaporelove' },
    { name: '화장발카페', url: 'https://cafe.naver.com/mp3musicdownloadcafe' },
    { name: '은빛 요정 비숑프리제', url: 'https://cafe.naver.com/gdqueen' },
    { name: '홈바리스타클럽', url: 'https://cafe.naver.com/bezzeraclub' },
    { name: '저탄고지라이프스타일', url: 'https://cafe.naver.com/lchfkorea' },
    { name: '거사모', url: 'https://cafe.naver.com/glove' }
  ],
  'IT/개발자': [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'KLDP', url: 'https://kldp.org', note: '리눅스/오픈소스' },
    { name: '데브피아', url: 'https://devpia.com' },
    { name: 'PHPSCHOOL', url: 'https://phpschool.com' },
    { name: '프로그래머스', url: 'https://programmers.co.kr' },
    { name: 'Baekjoon', url: 'https://acmicpc.net/board' },
    { name: 'OKKY', url: 'https://okky.kr/' }
  ],
  '해외/영어권': [
    { name: 'Reddit - r/korea', url: 'https://www.reddit.com/r/korea/', note: '한국 뉴스/문화/생활' },
    { name: 'Reddit - r/koreatravel', url: 'https://www.reddit.com/r/koreatravel/', note: '한국 여행 정보' },
    { name: 'Reddit - r/seoul', url: 'https://www.reddit.com/r/seoul/', note: '서울 생활/여행' }
  ]
};

// 외부유입 링크 모달 열기
export function openExternalLinksModal() {
  debugLog('EXTERNAL_LINKS', '외부유입 링크 모달 열기');
  
  const modal = document.getElementById('externalLinksModal');
  if (modal) {
    modal.style.display = 'flex';
    renderExternalLinks();
  }
}

// 외부유입 링크 모달 닫기
export function closeExternalLinksModal() {
  debugLog('EXTERNAL_LINKS', '외부유입 링크 모달 닫기');
  
  const modal = document.getElementById('externalLinksModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 외부유입 링크 렌더링
function renderExternalLinks() {
  const container = document.getElementById('externalLinksContent');
  if (!container) return;
  
  let html = '';
  
  Object.keys(externalLinksData).forEach(category => {
    const links = externalLinksData[category];
    
    html += `
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #ffd700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid rgba(255, 215, 0, 0.3);">
          ${category} (${links.length}개)
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
          ${links.map(link => `
            <button onclick="window.blogger.openExternal('${link.url}')" style="
              background: rgba(255, 215, 0, 0.1);
              border: 1px solid rgba(255, 215, 0, 0.3);
              border-radius: 8px;
              padding: 12px 16px;
              color: #ffd700;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              text-align: left;
              display: flex;
              flex-direction: column;
              gap: 4px;
            " onmouseover="this.style.background='rgba(255, 215, 0, 0.2)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255, 215, 0, 0.1)'; this.style.transform='translateY(0)'">
              <span style="font-size: 16px;">🔗 ${link.name}</span>
              ${link.note ? `<span style="font-size: 11px; color: rgba(255, 215, 0, 0.7);">${link.note}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 전역 함수로 등록
window.openExternalLinksModal = openExternalLinksModal;
window.closeExternalLinksModal = closeExternalLinksModal;



