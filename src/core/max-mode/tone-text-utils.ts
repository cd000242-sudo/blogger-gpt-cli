// src/core/max-mode/tone-text-utils.ts
// 말투/어투 지시사항 및 텍스트 유틸리티

/**
 * 말투/어투 지시사항 생성 함수
 */
export function getToneInstruction(toneStyle?: string): string {
  const toneInstructions: Record<string, string> = {
    'professional': '\n🎭 **말투/어투**: 전문적이고 신뢰할 수 있는 톤으로 작성하되, 독자가 쉽게 이해할 수 있도록 명확하고 간결하게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
    'friendly': '\n🎭 **말투/어투**: 친근하고 따뜻한 톤으로 작성하되, 마치 친구에게 설명하는 것처럼 자연스럽고 편안하게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
    'casual': '\n🎭 **말투/어투**: 캐주얼하고 편안한 톤으로 작성하되, 격식을 차리지 않고 자유롭고 부드럽게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
    'formal': '\n🎭 **말투/어투**: 격식있고 정중한 톤으로 작성하되, 존중과 정중함을 유지하면서도 독자가 이해하기 쉽게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
    'conversational': '\n🎭 **말투/어투**: 대화하듯이 자연스러운 톤으로 작성하되, 독자와 직접 대화하는 것처럼 친밀하고 소통하는 느낌으로 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.'
  };
  if (!toneStyle) {
    return toneInstructions['professional']!;
  }
  return toneInstructions[toneStyle] || toneInstructions['professional']!;
}

export function truncateText(value: string | null | undefined, maxLength: number): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
