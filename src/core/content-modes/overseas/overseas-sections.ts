// src/core/content-modes/overseas/overseas-sections.ts
/**
 * overseas 모드 전용 섹션 정의 — **영어** (v3.8.567)
 *
 * ## 왜 따로 만드나
 * 처음엔 `SEO_OPTIMIZED_MODE_SECTIONS` 를 재사용했다. 그랬더니 영어 프롬프트를
 * 다섯 군데나 갈았는데도 **H2 소제목이 한국어로 나왔다**:
 *
 *     1. 신라면 제대로 끓이기 전 알아둘 점
 *     2. 면발과 스프 맛을 살리는 조리 원리
 *
 * 이유는 단순하다. mode-dispatcher 는 플러그인의 `sections` 에서 h2Titles 를 만든다.
 * 즉 **H2 는 생성되는 게 아니라 이 정의에서 나온다.** 섹션 정의가 한국어면
 * 프롬프트를 아무리 영어로 써도 제목이 한국어로 박히고, 본문은 그 제목을 따라간다.
 *
 * ## 구성은 실측에서 나왔다
 * 2026-08-27 "best Korean instant ramen 2026" 영어권 상위를 훑어보니
 * 이기는 형식은 설명형이 아니라 **비교·등급·순위**였다(티어 리스트, 맵기 등급표,
 * 자체 점수 체계, 실매출 순위). 그래서 한국어판의 "정의 → 특성 → 실전 → 비교 → FAQ"
 * 를 그대로 옮기지 않고, **판정을 먼저 주고 비교로 채우는** 순서로 짰다.
 */

import type { MaxModeSection } from '../../max-mode-structure';

export const OVERSEAS_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: 'verdict_first',
    title: 'The Short Answer',
    description: 'Give the verdict before anything else, with the number that supports it',
    minChars: 700,
    role: 'A writer in Korea answering an English reader who wants to decide, not to study',
    contentFocus: 'Verdict → the number behind it → who should ignore this advice',
    requiredElements: [
      'Open with the answer in one sentence. No preamble.',
      'One concrete figure (time, amount, price, heat level) taken from the evidence',
      'One line on who this does not apply to',
      'Every Korean term glossed on first use: romanized form, then a short explanation',
    ],
  },
  {
    id: 'ranked_comparison',
    title: 'Ranked, With the Reason for Each Place',
    description: 'The comparison the reader came for — a table or ranked list, not prose',
    minChars: 700,
    role: 'A reviewer who has the Korean source data English sites do not',
    contentFocus: 'What ranks where, on what criterion, and why the order is that way',
    requiredElements: [
      'A table or ranked list — this section must not be prose only',
      'State the ranking criterion explicitly before the table',
      'One paragraph after the table saying which option wins and for whom',
      'Where the ranking comes from (Korean sales data, official spec, manufacturer figure)',
    ],
  },
  {
    id: 'how_it_actually_works',
    title: 'How It Actually Works',
    description: 'The mechanism, so the reader can adapt instead of only following steps',
    minChars: 700,
    role: 'Someone explaining why the instructions say what they say',
    contentFocus: 'Cause and effect — change this, and that happens',
    requiredElements: [
      'Explain the reason behind the standard instruction, not just the instruction',
      'At least one "if you change X, expect Y" pairing with a number',
      'Name the common mistake and what it produces',
    ],
  },
  {
    id: 'outside_korea',
    title: 'What Changes Outside Korea',
    description: 'The section only a writer inside Korea can produce',
    minChars: 700,
    role: 'A writer who knows both the Korean price and the export reality',
    contentFocus: 'Price gap, availability, different formulations sold abroad, substitutes',
    requiredElements: [
      'Price in Korea versus what a reader abroad typically pays, with both currencies',
      'Where a reader outside Korea can actually buy it',
      'What to substitute when they cannot get it',
      'Any difference between the domestic and export version, if the evidence shows one',
    ],
  },
  {
    id: 'personal_experience',
    title: 'What I Would Tell a Friend',
    description: 'Only rendered when the author supplied real experience — never invented',
    minChars: 600,
    role: 'The author speaking plainly, using only what they actually said',
    contentFocus: 'The opinion the author gave, and the reasoning behind it',
    requiredElements: [
      'Use only the experience notes supplied. Invent nothing.',
      'State the position outright, including where it disagrees with common advice',
      'Say what would change that position',
    ],
  },
];
