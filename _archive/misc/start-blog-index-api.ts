/**
 * 블로그 지수 API 서버 실행 스크립트
 */

import { startApiServer } from './src/api/blog-index-api';

const port = process.env['PORT'] ? parseInt(process.env['PORT']) : 3000;

console.log('='.repeat(80));
console.log('🚀 블로그 지수 API 서버 시작');
console.log('='.repeat(80));
console.log('');

startApiServer(port);







