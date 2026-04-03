// content-stubs.js — 콘텐츠변환 탭 stub 함수
// content-tab의 onclick 핸들러가 참조하는 함수들의 placeholder.
// 향후 각 기능을 점진적으로 구현하면 이 파일을 교체합니다.

export function initContentStubs() {
    window.generateContentVariation = (type) => {
        window.showNotification?.(`콘텐츠 변환 (${type}) — 향후 구현 예정입니다.`, 'info');
        console.log('[CONTENT] generateContentVariation:', type);
    };

    window.generateAllVariations = () => {
        window.showNotification?.('전체 변형 생성 — 향후 구현 예정입니다.', 'info');
    };

    window.previewVariations = () => {
        window.showNotification?.('변형 미리보기 — 향후 구현 예정입니다.', 'info');
    };

    window.copyVariations = () => {
        window.showNotification?.('변형 복사 — 향후 구현 예정입니다.', 'info');
    };

    window.postVariations = () => {
        window.showNotification?.('변형 발행 — 향후 구현 예정입니다.', 'info');
    };

    window.clearVariations = () => {
        const el = document.getElementById('variationResults');
        if (el) el.innerHTML = '<p style="color: #6b7280; text-align: center; margin: 20px 0;">변형된 콘텐츠가 여기에 표시됩니다</p>';
    };

    window.setAIProvider = (type) => {
        console.log('[CONTENT] AI Provider 설정:', type);
        window.showNotification?.(`AI Provider: ${type} 설정 완료`, 'info');
    };

    console.log('[CONTENT] ✅ 콘텐츠변환 stub 함수 등록 완료');
}
