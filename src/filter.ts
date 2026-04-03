export function filterOverclaim(text: string): string {
  return text
    .replace(/단\s?\d+\s?주\s?만에/g, '짧은 기간 동안')
    .replace(/무조건/g, '대부분의 경우')
    .replace(/보장됩니다/g, '도움이 될 수 있습니다')
    .replace(/확실하게/g, '효과를 기대할 수 있음')
    .replace(/폭발적으로/g, '눈에 띄게')
    .replace(/100%/g, '높은 확률로');
}
