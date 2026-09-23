import * as cheerio from 'cheerio';
import postcss from 'postcss';
import { flattenDocumentForPost } from '../src/core/final/style-preservation';

function flatten(css: string, body = '<p id="inside">본문</p>') {
  const result = flattenDocumentForPost(`<!doctype html><html class="dark" lang="ko"><head><style>${css}</style></head><body class="custom">${body}</body></html>`);
  return cheerio.load(`<html><body><p id="outside">호스트</p>${result.html}</body></html>`);
}

describe('imported full document CSS survives publishing', () => {
  test('body, html and :root selectors still match the corresponding wrappers', () => {
    const $ = flatten('body.custom > p { color: red } html.dark { --ink: navy } :root { --space: 9px }');
    const rules: postcss.Rule[] = [];
    postcss.parse($('style').text()).walkRules(rule => { rules.push(rule); });
    expect($(rules[0]!.selector).map((_i, e) => $(e).attr('id')).get()).toEqual(['inside']);
    expect($(rules[1]!.selector).attr('lang')).toBe('ko');
    expect($(rules[2]!.selector).attr('lang')).toBe('ko');
    expect($(rules[2]!.selector).is('html')).toBe(false);
  });

  test('ordinary selectors cannot restyle the host or another imported document', () => {
    const one = flattenDocumentForPost('<html><head><style>p{color:red}</style></head><body><p id="one">one</p></body></html>').html;
    const two = flattenDocumentForPost('<html><head><style>p{color:blue}</style></head><body><p id="two">two</p></body></html>').html;
    const $ = cheerio.load(`<p id="outside">host</p>${one}${two}`);
    const rules: string[] = [];
    postcss.parse($('style').first().text()).walkRules(rule => { rules.push(rule.selector); });
    expect($(rules[0]!).map((_i, e) => $(e).attr('id')).get()).toEqual(['one']);
  });

  test('nested selectors and conditional rules work without changing declarations or keyframes', () => {
    const css = '@media (min-width: 1px){:is(html.dark, body.custom) > p{content:"body > html";background:url("data:image/svg+xml,<svg>{body}</svg>")}} @keyframes spin{from{opacity:0}to{opacity:1}}';
    const $ = flatten(css);
    const parsed = postcss.parse($('style').text());
    const rules: postcss.Rule[] = [];
    parsed.walkRules(rule => { rules.push(rule); });
    expect($(rules[0]!.selector).attr('id')).toBe('inside');
    expect(rules[0]!.nodes.map(n => n.toString())).toEqual(['content:"body > html"', 'background:url("data:image/svg+xml,<svg>{body}</svg>")']);
    expect(rules.slice(1).map(r => r.selector)).toEqual(['from', 'to']);
  });

  test('stylesheet links and style blocks retain source order and media attributes', () => {
    const out = flattenDocumentForPost('<html><head><link rel="stylesheet" href="first.css"><style media="screen">p{color:red}</style><link rel="stylesheet" href="last.css"><style media="print">p{color:black}</style></head><body><style>body{color:green}</style><p>text</p></body></html>').html;
    const $ = cheerio.load(out);
    expect($('link,style').map((_i, e) => e.tagName === 'link' ? $(e).attr('href') : $(e).attr('media') || 'body-style').get()).toEqual(['first.css', 'screen', 'last.css', 'print', 'body-style']);
  });

  test('html/body attributes roundtrip quoted values without injecting attributes', () => {
    const out = flattenDocumentForPost(`<html class='dark' data-note='a"b' lang='ko'><head></head><body id='article' class='a" autofocus="yes' style='font-family:"A > B";color:red'><p>text</p></body></html>`).html;
    const $ = cheerio.load(out);
    expect($('[data-note]').attr('data-note')).toBe('a"b');
    expect($('#article').attr('class')).toBe('orbit-import a" autofocus="yes');
    expect($('#article').attr('style')).toBe('font-family:"A > B";color:red');
    expect($('[autofocus]')).toHaveLength(0);
  });

  test('pseudo elements retain a valid subject scope and CSS nesting stays intact', () => {
    const $ = flatten('body > p::before{content:"body"} body{ & > p {color:red} }');
    const css = $('style').text();
    const rules: postcss.Rule[] = [];
    postcss.parse(css).walkRules(rule => { rules.push(rule); });
    expect(rules[0]!.selector).toMatch(/\)::before$/);
    expect($(rules[0]!.selector.replace('::before', '')).attr('id')).toBe('inside');
    expect(rules[2]!.selector).toContain('& > p');
  });

  test('ordinary div rules do not start matching the html/body transport wrappers', () => {
    const $ = flatten('div{padding:99px}', '<div id="card">card</div>');
    const rule = postcss.parse($('style').text()).first as postcss.Rule;
    expect($(rule.selector).map((_i, e) => $(e).attr('id')).get()).toEqual(['card']);
  });
});
