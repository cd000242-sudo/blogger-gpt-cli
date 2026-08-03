/**
 * 품질 보강이 멀쩡한 본문을 지우지 못하게 한다 (v3.8.429)
 *
 * 사용자 보고(2026-08-03): "H2·H3 제목은 나오는데 본문 단락이 통째로 비어 있다"
 *
 * 원인: generateAllSectionsFinal 의 "본문 품질 보강" 단계가 파싱만 되면
 *   `allSectionsObj = safeParseJson(improvedJson)` 로 원본을 **통째로 덮어썼다.**
 *   이 보강 호출은 입력(원본 JSON 전체)도 크고 출력 요구(H3마다 600자 이상)도 커서
 *   출력이 잘리기 쉽다. 잘린 응답이 safeParseJson 의 3차 복구(마지막 '}' 까지 잘라
 *   파싱)를 타면 "파싱은 되지만 뒷부분 content 가 빈" JSON 이 나오고, 그게 멀쩡한
 *   원본을 덮어썼다 — 제목만 남고 본문이 사라진다. 로그에는 "보강 완료"로 찍혀서
 *   조용한 실패였다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const gen = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'generation.ts'), 'utf8');

/** 보강 호출 ~ 결과 정규화 직전까지 */
const boostBlock = blockBetween(
  gen,
  'const improved = await callGeminiWithRetry(improvePrompt);',
  '// 결과 정규화 및 에디팅 톤 변환',
);

describe('보강 결과는 검증 후에만 반영한다', () => {
  it('⭐ 파싱 결과를 곧바로 allSectionsObj에 대입하지 않는다 (candidate로 받는다)', () => {
    expect(boostBlock).toContain('const candidate = safeParseJson(improvedJson);');
    // 예전의 무조건 덮어쓰기가 남아 있으면 안 된다
    expect(boostBlock).not.toContain('allSectionsObj = safeParseJson(improvedJson);');
  });

  it('⭐ 섹션 수가 줄면 폐기한다', () => {
    expect(boostBlock).toContain('sectionCount(candidate) < sectionCount(allSectionsObj)');
  });

  it('⭐ 빈 본문이 늘면 폐기한다 (사용자가 겪은 바로 그 증상)', () => {
    expect(boostBlock).toContain('emptyContentCount(candidate) > emptyContentCount(allSectionsObj)');
  });

  it('⭐ 총 분량이 원본의 80% 미만이면 폐기한다', () => {
    expect(boostBlock).toContain('afterLen < beforeLen * 0.8');
  });

  it('⭐ 검증을 통과한 경우에만 원본을 교체한다', () => {
    expect(boostBlock).toContain('allSectionsObj = candidate;');
    // 폐기 경로에서는 사용자에게 이유를 알린다
    expect(boostBlock).toContain('원본을 유지합니다');
  });

  it('폐기 사유를 로그에 남긴다 — 조용한 실패를 끝낸다', () => {
    expect(boostBlock).toContain('reasons.join');
  });
});

describe('본문이 비면 반드시 로그에 남는다 (발행은 막지 않는다)', () => {
  it('⭐ 빈 소제목 개수를 세어 경고한다', () => {
    expect(gen).toContain('본문이 비어 있는 소제목');
  });

  it('⭐ 발행을 차단하지 않는다 — throw 가 아니라 로그다', () => {
    const guard = blockBetween(
      gen,
      'v3.8.429 — 본문이 빈 채로 조용히 나가지 않게 한다',
      '// 결과 정규화 및 에디팅 톤 변환',
    );
    expect(guard).not.toContain('throw ');
    expect(guard).toContain('onLog?.(');
  });

  it('어느 섹션이 비었는지 위치까지 알려준다', () => {
    expect(gen).toContain('const where = emptyH3s.map');
  });
});
