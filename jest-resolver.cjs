const path = require('path');
const fs = require('fs');

/**
 * Custom Jest resolver: .ts 파일이 있으면 .js 대신 .ts를 우선 로드
 */
module.exports = (request, options) => {
  const defaultResolver = options.defaultResolver;

  try {
    // 먼저 기본 resolver로 시도
    const resolved = defaultResolver(request, options);

    // 결과가 src/ 안의 .js 파일이면 같은 이름의 .ts가 있는지 확인
    if (resolved.endsWith('.js') && resolved.includes(path.sep + 'src' + path.sep)) {
      const tsPath = resolved.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsPath)) {
        return tsPath;
      }
    }

    return resolved;
  } catch (e) {
    // .ts 확장자로 직접 시도
    try {
      return defaultResolver(request.replace(/\.js$/, '.ts'), options);
    } catch {
      throw e;
    }
  }
};
