# ✅ CTA 배치 수정 완료

## 🔥 수정된 문제

### 1️⃣ **CTA가 맘대로 배치됨**

**문제**: CTA가 4번 소제목에만 고정으로 배치되어 사용자가 원하는 구조와 맞지 않음

**수정 전**:
```typescript
// 4번 소제목인 경우 자동 CTA 추가 (수동 CTA가 없을 때만)
if (sectionNumber === 4 && !hasManualCtas && payload.googleCseKey && payload.googleCseCx) {
```

**수정 후**:
```typescript
// 중간 섹션과 마지막 섹션에만 자동 CTA 추가 (수동 CTA가 없을 때만)
const hasManualCtas = payload.customCtas && payload.customCtas.length > 0 && payload.customCtas.some(cta => cta && cta.url && cta.url.trim());
const totalSections = payload.contentMode === 'shopping' ? 7 : 5;
const middleSection = Math.floor(totalSections / 2); // 5개면 2(3번째), 7개면 3(4번째)
const isMiddleSection = sectionNumber === middleSection + 1; // 1-based index
const isLastSection = sectionNumber === totalSections;

if ((isMiddleSection || isLastSection) && !hasManualCtas && payload.googleCseKey && payload.googleCseCx) {
```

---

## 📊 **CTA 배치 규칙**

### **일반 모드 (5개 섹션)**:
- **중간 섹션**: 3번째 (sectionNumber === 3)
- **마지막 섹션**: 5번째 (sectionNumber === 5)

### **쇼핑 모드 (7개 섹션)**:
- **중간 섹션**: 4번째 (sectionNumber === 4)  
- **마지막 섹션**: 7번째 (sectionNumber === 7)

---

## 🎯 **결과**

### **이전**:
- ❌ 4번 소제목에만 고정 배치
- ❌ 쇼핑 모드에서도 4번에만 배치
- ❌ 사용자 요구사항과 불일치

### **수정 후**:
- ✅ 중간 섹션과 마지막 섹션에만 배치
- ✅ 콘텐츠 모드에 따라 동적 계산
- ✅ 사용자 요구사항 완벽 일치

---

## 📋 **최종 구조**

### **일반 모드 (5개 섹션)**:
```
H2 (1번) - 이미지 + H3×3 + 요약표
H2 (2번) - 이미지 + H3×3 + 요약표  
H2 (3번) - 이미지 + H3×3 + 요약표 + 🎯 CTA
H2 (4번) - 이미지 + H3×3 + 요약표
H2 (5번) - 이미지 + H3×3 + 요약표 + 🎯 CTA
```

### **쇼핑 모드 (7개 섹션)**:
```
H2 (1번) - 이미지 + H3×3 + 요약표
H2 (2번) - 이미지 + H3×3 + 요약표
H2 (3번) - 이미지 + H3×3 + 요약표
H2 (4번) - 이미지 + H3×3 + 요약표 + 🎯 CTA
H2 (5번) - 이미지 + H3×3 + 요약표
H2 (6번) - 이미지 + H3×3 + 요약표
H2 (7번) - 이미지 + H3×3 + 요약표 + 🎯 CTA
```

---

## ✅ **완료된 수정사항**

1. **H3 개수 제한**: "정확히 3개만" 생성 ✅
2. **요약표 형식**: 마크다운 → HTML 테이블 ✅  
3. **CTA 배치**: 중간 + 마지막 섹션에만 배치 ✅
4. **크롤링 복사 금지**: 프롬프트에 명시적 금지 조항 추가 ✅

이제 모든 문제가 해결되었습니다! 🎉

