import { analyzeShortents, scoreShortents, normalizeShortents } from '../src/core/shortents-analysis';

const now = Date.parse('2026-09-17T12:00:00Z');
const item = {keyword:'가을 여행', url:'https://search.naver.com/'};
const blog = {ok:true,total:100,items:[{title:'가을 여행 안내'},{title:'다른 이야기'}]};
const news = {ok:true,items:[{title:'가을 여행 새 소식',pubDate:'2026-09-17T10:00:00Z',link:'https://news.example/a'}]};

test('failures and empty search responses never imply easy competition', () => {
  expect(scoreShortents(item,{ok:false,items:[],error:'한도 초과'},news,now).score).toBeNull();
  expect(scoreShortents(item,{ok:true,items:[]},news,now).score).toBeNull();
  expect(scoreShortents(item,{ok:true,total:0,items:[]},news,now).verdict).toBe('근거 부족');
  expect(scoreShortents(item,blog,{ok:true,items:[]},now).score).toBeNull();
});

test('only current unique news is counted; future, invalid, stale dates are excluded', () => {
  const result = scoreShortents(item,blog,{ok:true,items:[...news.items,...news.items,
    {title:'미래',pubDate:'2026-09-18T00:00:00Z'}, {title:'과거',pubDate:'2026-09-14T00:00:00Z'},
    {title:'날짜 없음',pubDate:''}]},now);
  expect(result.recentNews).toBe(1);
  expect(result.directTitles).toBe(1);
  expect(result.sampleSize).toBe(2);
  expect(result.evidence[0]!.url).toBe('https://news.example/a');
  expect(result.score).toBeGreaterThan(0);
  expect(result.score).toBeLessThanOrEqual(100);
});

test('collect all supplied candidates, deduplicate and rank from measured samples', async () => {
  const calls: string[] = [];
  const result = await analyzeShortents([item,item,{keyword:'다른 주제',url:''}],async (type,p) => {
    calls.push(type+':'+p['query']);
    return type==='news' ? news : {...blog,total:p['query']==='다른 주제'?1000000:10};
  },now);
  expect(calls).toHaveLength(4);
  expect(result).toHaveLength(2);
  expect(result[0]!.keyword).toBe('가을 여행');
});

test('network exceptions remain visible and no score is invented', async () => {
  const result = await analyzeShortents([item],async () => {throw Error('timeout');},now);
  expect(result[0]!.error).toContain('timeout');
  expect(result[0]!.score).toBeNull();
});

test('candidate input is bounded and display links cannot execute code', async () => {
  expect(normalizeShortents([{keyword:'<b>주제</b>',url:'javascript:alert(1)'}])[0]!.url).toMatch(/^https:\/\/search.naver.com/);
  await expect(analyzeShortents([],async()=>blog)).rejects.toThrow('없습니다');
  await expect(analyzeShortents(Array.from({length:21},(_,i)=>({keyword:'주제'+i,url:''})),async()=>blog)).rejects.toThrow('20개');
});
