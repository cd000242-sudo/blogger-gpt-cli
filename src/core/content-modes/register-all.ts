// src/core/content-modes/register-all.ts
// 모든 콘텐츠 모드 플러그인을 한 번에 등록 — 이 파일을 import 하면 5개 모드가 모두 레지스트리에 올라감

import './adsense/adsense-mode';
import './external/external-mode';
import './internal/internal-mode';
import './shopping/shopping-mode';
import './paraphrasing/paraphrasing-mode';
// v3.8.566 (E2): 해외(영어권) 모드. 기존 모드 프롬프트가 전부 한국어라 영어 글이 안 나왔다.
import './overseas/overseas-mode';
