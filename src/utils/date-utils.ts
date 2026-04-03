/**
 * 날짜 및 연도 관련 유틸리티
 */

/**
 * 현재 연도 반환
 */
export function getCurrentYear(): number {
    return new Date().getFullYear();
}

/**
 * 지정된 연도의 간지(Zodiac) 정보를 반환 (예: 2026 -> 병오년)
 * @param year 계산할 연도 (기본값: 현재 연도)
 */
export function getKoreanZodiac(year: number = getCurrentYear()): string {
    const gan = ['경', '신', '임', '계', '갑', '을', '병', '정', '무', '기']; // 천간 (10간)
    const ji = ['경', '신', '임', '계', '갑', '을', '병', '정', '무', '기', '경', '신']; // 오타 수정 전: 자축인묘진사오미신유술해

    // 실제 한국 간지 계산 로직
    // 천간: 연도의 끝자리 (예: 2026 -> 6 -> 병)
    // 지지: 연도를 12로 나눈 나머지 (예: 2026 % 12 -> 10 -> 오)

    const tenGan = ['경', '신', '임', '계', '갑', '을', '병', '정', '무', '기'];
    const twelveJi = ['신', '유', '술', '해', '자', '축', '인', '묘', '진', '사', '오', '미'];

    const ganIdx = year % 10;
    const jiIdx = year % 12;

    return `${tenGan[ganIdx]}${twelveJi[jiIdx]}년`;
}

/**
 * 프롬프트용 현재 날짜 정보 문자열 반환
 */
export function getCurrentDateInfo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const zodiac = getKoreanZodiac(year);

    return `${year}년 ${zodiac} ${month}월 ${day}일 시점`;
}
