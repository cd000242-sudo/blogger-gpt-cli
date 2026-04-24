/**
 * Dry-Run: 5개 콘텐츠 모드의 프롬프트 조립 결과를 파일로 덤프
 *
 * AI API 호출 없이 dispatchMode + 모드별 섹션 가이드 + 검색의도 분류기를
 * 실행해서 실제로 AI에 전달되는 프롬프트가 어떻게 생기는지 확인할 수 있다.
 *
 * 사용:
 *   npx tsx scripts/dry-run-modes.ts [keyword]
 *
 * 출력:
 *   ./dry-run-output/{mode}.txt
 */

import * as fs from 'fs';
import * as path from 'path';

// 플러그인 자동 등록 트리거 — 5개 모드 모두 등록
import '../src/core/content-modes/register-all';

import { dispatchMode } from '../src/core/final/mode-dispatcher';
import { classifyIntent, buildIntentPromptBlock } from '../src/core/search-intent-classifier';

const KEYWORD = process.argv[2] || '커피머신 추천';
const MODES = ['external', 'internal', 'shopping', 'adsense', 'paraphrasing'] as const;
const OUTPUT_DIR = path.resolve(process.cwd(), 'dry-run-output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`\n🧪 Dry-Run 시작 — 키워드: "${KEYWORD}"\n`);

const intent = classifyIntent(KEYWORD);
console.log(`🎯 감지된 검색 의도: ${intent}\n`);

for (const mode of MODES) {
  console.log(`📋 모드: ${mode}`);
  // adsense 모드는 저자 프로필 있음/없음 두 가지 케이스 모두 덤프
  const cases = mode === 'adsense'
    ? [
        { label: 'with-author', authorInfo: { name: '홍길동', title: '카페 컨설턴트', credentials: '바리스타 자격증, 8년 경력' } },
        { label: 'no-author', authorInfo: undefined },
      ]
    : [{ label: 'default', authorInfo: undefined }];

  for (const c of cases) {
    const result = dispatchMode(mode, KEYWORD, { authorInfo: c.authorInfo });

    const sections = (result.h2Titles || []).map((t, i) => `  ${i + 1}. ${t}`).join('\n');
    const dump = `========================================
모드: ${mode}${c.label !== 'default' ? ` (${c.label})` : ''}
키워드: ${KEYWORD}
검색의도: ${intent}
========================================

▶ 플러그인 처리 여부: ${result.handledByPlugin ? '✅ 플러그인' : '❌ 폴백(하드코딩)'}

▶ H2 섹션 (${(result.h2Titles || []).length}개):
${sections || '  (없음 — orchestration 폴백 경로)'}

▶ 검색 의도 가이드:
${buildIntentPromptBlock(KEYWORD)}

▶ 섹션 프롬프트 블록 (AI에 전달):
${result.sectionPromptBlock || '  (없음 — orchestration 폴백 경로)'}

▶ CSS 플러그인: ${result.cssPlugin ? 'YES' : 'NO'}
▶ 후처리 플러그인: ${result.postProcessPlugin ? 'YES' : 'NO'}
`;

    const fileName = c.label === 'default' ? `${mode}.txt` : `${mode}-${c.label}.txt`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, dump, 'utf-8');
    console.log(`  ✅ ${fileName} (${dump.length}자)`);
  }
}

console.log(`\n📁 출력 디렉토리: ${OUTPUT_DIR}`);
console.log(`\n✨ Dry-Run 완료. 위 파일들을 열어 프롬프트 품질을 확인하세요.\n`);
