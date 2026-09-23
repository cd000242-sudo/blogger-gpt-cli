import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { analyzeShortents } from '../src/core/shortents-analysis';

function loadHandler(search: jest.Mock, list = jest.fn()) {
  const source = fs.readFileSync(path.join(__dirname,'../electron/main.ts'),'utf8');
  const block = source.slice(source.indexOf('const shortentsPending'),source.indexOf('// 황금 키워드 발굴',source.indexOf('const shortentsPending')));
  const compiled = require('typescript').transpileModule(block,{compilerOptions:{target:7,module:1}}).outputText;
  let handler: any;
  const ipcMain = { handle: (_name: string, fn: any) => {handler=fn;} };
  vm.runInNewContext(compiled, {ipcMain, Date, Map, Promise, loadEnvFromFile:()=>({}), require:(name:string)=> {
    if(name.endsWith('shortents-analysis')) return {analyzeShortents};
    if(name.endsWith('shortents-source')) return {listShortents:list};
    if(name.endsWith('naver-search-client')) return {naverSearch:search};
    throw Error('unexpected module '+name);
  }});
  return handler;
}

test('duplicate concurrent manual requests share searches, then reuse cache', async()=> {
  const search=jest.fn(async(type:string)=>type==='blog'
    ? {ok:true,total:100,items:[{title:'가을 여행 안내'}]}
    : {ok:true,items:[{title:'오늘의 가을 여행',pubDate:new Date().toUTCString()}]});
  const handler=loadHandler(search);
  const [first,second]=await Promise.all([handler(null,{keywords:['가을 여행']}),handler(null,{keywords:['가을 여행']})]);
  expect(first.ok).toBe(true);
  expect(second.results).toEqual(first.results);
  expect(search).toHaveBeenCalledTimes(2);
  expect((await handler(null,{keywords:['가을 여행']})).cached).toBe(true);
  expect(search).toHaveBeenCalledTimes(2);
});

test('input validation and collector failure never trigger analysis', async()=> {
  const search=jest.fn();
  const list=jest.fn(async()=>{throw Error('수집 실패');});
  const handler=loadHandler(search,list);
  expect((await handler(null,{keywords:'wrong'})).ok).toBe(false);
  expect((await handler(null,{})).error).toContain('수집 실패');
  expect(search).not.toHaveBeenCalled();
  expect(list).toHaveBeenCalledTimes(1);
});

test('failed searches are not cached as opportunities',async()=> {
  const search=jest.fn(async()=>({ok:false,items:[],error:'API 오류'}));
  const handler=loadHandler(search);
  expect((await handler(null,{keywords:['주제']})).results[0].score).toBeNull();
  await handler(null,{keywords:['주제']});
  expect(search).toHaveBeenCalledTimes(4);
});
