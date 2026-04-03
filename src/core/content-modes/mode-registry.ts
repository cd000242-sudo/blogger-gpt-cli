// src/core/content-modes/mode-registry.ts
// 모듈화된 콘텐츠 모드 등록/조회 레지스트리
// 레지스트리에 등록된 모드는 max-mode-structure.ts의 기존 로직보다 우선 적용됨

import type { ContentModePlugin } from './mode-interface';

/** 등록된 모드 저장소 */
const registry = new Map<string, ContentModePlugin>();

/**
 * 모드를 레지스트리에 등록
 * @param mode ContentModePlugin 구현체
 */
export function registerMode(mode: ContentModePlugin): void {
    if (registry.has(mode.id)) {
        console.warn(`[mode-registry] 모드 '${mode.id}' 덮어쓰기`);
    }
    registry.set(mode.id, mode);
    console.log(`[mode-registry] 모드 '${mode.id}' 등록 완료 (${mode.config.name})`);
}

/**
 * ID로 모드 조회 (없으면 undefined)
 */
export function getMode(id: string): ContentModePlugin | undefined {
    return registry.get(id);
}

/**
 * 등록된 모든 모드 반환
 */
export function getAllModes(): ContentModePlugin[] {
    return Array.from(registry.values());
}

/**
 * 등록된 모든 모드 ID 반환
 */
export function getRegisteredModeIds(): string[] {
    return Array.from(registry.keys());
}

/**
 * 모드가 레지스트리에 등록되어 있는지 확인
 */
export function hasMode(id: string): boolean {
    return registry.has(id);
}
