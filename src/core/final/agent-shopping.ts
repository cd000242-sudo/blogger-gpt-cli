/**
 * agent-shopping — 에이전트 모드에서도 쇼핑 글이 API 경로와 같은 결과를 내게 한다.
 *
 * ## 무엇이 빠져 있었나
 * 에이전트는 텍스트만 만들고 외부 API 를 못 쓴다. 그래서 쇼핑 모드로 돌려도
 * 상품 데이터·제휴링크·위젯·공정위 문구가 하나도 붙지 않았다 (실측: 관련 코드 0건).
 *
 * ## 두 시점에 나눠 붙인다
 *   ① 에이전트 실행 **전** — 쿠팡에서 실제 상품을 조회해 지시서에 넣는다.
 *      그래야 에이전트가 실재하는 제품·가격을 보고 쓴다. 안 주면 지어낸다.
 *   ② 에이전트 실행 **후** — 상품 위젯·대가성 문구를 앱이 붙이고 컴플라이언스를 건다.
 *      에이전트가 만든 제휴링크는 100% 죽은 링크라 애초에 만들지 말라고 막아둔다.
 *
 * ## 이미지는 쿠팡이 준 것만 쓴다
 * 상품 이미지는 쿠팡 파트너스가 제휴사에게 제공하는 productImage 다.
 * 크롤링한 남의 사진을 가져다 쓰지 않는다 — 저작권 문제가 된다.
 */
import {
  searchCoupangProducts,
  formatProductsForPrompt,
  renderCoupangProductBlock,
  renderCoupangDisclosureBanner,
  enforceCoupangCompliance,
} from '../coupang-partners';

export interface AgentShoppingKeys {
  accessKey?: string;
  secretKey?: string;
}

export interface AgentShoppingMaterial {
  /** 조회된 실제 상품 (없으면 빈 배열) */
  products: any[];
  /** 지시서에 붙일 상품 데이터 블록 (없으면 빈 문자열) */
  promptBlock: string;
  /** 사용자에게 보여줄 한 줄 상태 */
  note: string;
}

const EMPTY: AgentShoppingMaterial = { products: [], promptBlock: '', note: '' };

/** 쇼핑 모드인가 */
export function isShoppingMode(contentMode?: string): boolean {
  return String(contentMode || '').trim().toLowerCase() === 'shopping';
}

/**
 * 에이전트에게 먹일 실제 상품 데이터를 가져온다.
 *
 * 쇼핑 모드가 아니거나 키가 없으면 조용히 빈 결과를 돌려준다 —
 * 여기서 실패해도 글은 나와야 한다.
 */
export async function fetchAgentShoppingMaterial(
  keyword: string,
  contentMode: string | undefined,
  keys: AgentShoppingKeys,
): Promise<AgentShoppingMaterial> {
  try {
    if (!isShoppingMode(contentMode)) return EMPTY;

    const accessKey = String(keys?.accessKey || '').trim();
    const secretKey = String(keys?.secretKey || '').trim();
    if (!accessKey || !secretKey) {
      return { ...EMPTY, note: '쿠팡 파트너스 키가 없어 상품 데이터 없이 진행합니다' };
    }

    const products = await searchCoupangProducts(keyword, accessKey, secretKey, 10);
    if (!products || products.length === 0) {
      return { ...EMPTY, note: '쿠팡 검색 결과가 없어 상품 데이터 없이 진행합니다' };
    }

    return {
      products,
      promptBlock: formatProductsForPrompt(products),
      note: `쿠팡 상품 ${products.length}개를 에이전트에게 전달했습니다`,
    };
  } catch (error: any) {
    console.warn('[AGENT-SHOPPING] 상품 조회 스킵:', String(error?.message || error).slice(0, 120));
    return { ...EMPTY, note: '상품 조회에 실패해 상품 데이터 없이 진행합니다' };
  }
}

export interface AgentShoppingAttachResult {
  html: string;
  /** 실제로 붙인 것들 — 로그용 */
  attached: string[];
}

/**
 * 에이전트가 돌려준 글에 상품 위젯·대가성 문구를 붙이고 컴플라이언스를 건다.
 *
 * 쇼핑 글이 아니면 손대지 않는다. 어떤 경우에도 던지지 않는다 —
 * 여기서 막히면 이미 몇 분을 쓴 에이전트 결과가 통째로 날아간다.
 */
export function attachAgentShoppingBlocks(
  html: string,
  products: any[],
  contentMode?: string,
): AgentShoppingAttachResult {
  const attached: string[] = [];
  let out = String(html || '');

  try {
    if (!isShoppingMode(contentMode)) return { html: out, attached };

    if (Array.isArray(products) && products.length > 0) {
      out += renderCoupangProductBlock(products);
      attached.push(`상품 위젯 ${products.length}개`);
    }

    /**
     * 대가성 문구는 상품 위젯(=제휴링크)이 실제로 붙었을 때만 넣는다.
     * 제휴 관계가 없는 글에 "수수료를 받습니다" 를 달면 사실과 다른 고지가 된다.
     */
    if (attached.length > 0) {
      const banner = renderCoupangDisclosureBanner();
      out = out.includes('<!-- COUPANG_DISCLOSURE_PLACEHOLDER -->')
        ? out.replace('<!-- COUPANG_DISCLOSURE_PLACEHOLDER -->', banner)
        : banner + out;
      attached.push('공정위 대가성 문구');

      const compliance = enforceCoupangCompliance(out);
      out = compliance.html || out;
      attached.push(compliance.fixes.length > 0
        ? `컴플라이언스 보정 ${compliance.fixes.length}건`
        : '컴플라이언스 점검');
    }

    return { html: out, attached };
  } catch (error: any) {
    console.warn('[AGENT-SHOPPING] 블록 부착 스킵:', String(error?.message || error).slice(0, 120));
    return { html: String(html || ''), attached };
  }
}
