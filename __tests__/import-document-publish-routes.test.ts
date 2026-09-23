import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as preservation from '../src/core/final/style-preservation';
import { updateWordPressPost } from '../src/wordpress/wordpress-posts';
import { unwrapHtmlBlock } from '../src/wordpress/wp-html-block';
import { buildTistoryFinalHtml, fillHtmlEditor } from '../src/tistory/tistory-publisher';
import { humanPaste, humanType } from '../src/tistory/tistory-session';

jest.mock('../src/env', () => ({ loadEnvFromFile: jest.fn(() => ({})) }));
jest.mock('../src/tistory/tistory-session', () => ({
  humanPaste: jest.fn(async () => true),
  humanType: jest.fn(async () => true),
}));

const full = '<html class="dark"><head><style>body.custom>p{color:red}:root{--ink:navy}</style></head><body class="custom"><p>원문 내용</p></body></html>';
const flattened = preservation.flattenDocumentForPost(full).html;
const fragment = '<style>.article p{color:red}</style><article class="article"><p>조각 원문</p></article>';
const inputs = [ ['full document', full, flattened], ['fragment', fragment, fragment], ['already flattened', flattened, flattened] ];

describe('imported HTML reaches publisher/update boundaries without losing its design', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(inputs)('WordPress update: %s', async (_kind, content, expected) => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id: 42, link: 'https://example.invalid/post' }) } as Response);
    const result = await updateWordPressPost({ postId: 42, content, payload: { siteUrl: 'https://example.invalid', username: 'test', password: 'test' } });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(unwrapHtmlBlock(sent.content)).toBe(expected);
  });

  test.each(inputs)('Blogger update: %s', async (_kind, content, expected) => {
    const patch = jest.fn(async () => ({ data: { id: '42' } }));
    const context = {
      module: { exports: {} as any }, console, Buffer,
      require: (id: string) => {
        if (id === './final/style-preservation') return preservation;
        if (id === 'google-auth-library') return {};
        if (id === 'googleapis') return { google: {} };
        if (id === 'stream') return require('stream');
        throw new Error(`Unexpected dependency in offline publisher test: ${id}`);
      },
      __client: { blogger: { posts: { patch } }, blogId: '123' },
    };
    // Execute the actual JS module while replacing the authentication boundary;
    // no Google client, token files or network can be reached by this test.
    const source = fs.readFileSync(path.join(__dirname, '../src/core/blogger-publisher.js'), 'utf8');
    vm.runInNewContext(source + '\ncreateBloggerApiClient = async () => __client;', context);
    const result = await context.module.exports.updateBloggerPost({ postId: '42', content });
    expect(result.ok).toBe(true);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0]![0].requestBody.content).toBe(expected);
  });

  test.each(inputs)('Tistory shared writer used by new posts and updates: %s', async (_kind, content, expected) => {
    jest.mocked(humanPaste).mockClear();
    jest.mocked(humanType).mockClear();
    const locator = { count: async () => 1, isVisible: async () => true };
    const page = { locator: () => ({ first: () => locator }) };
    expect(await fillHtmlEditor(page, content!)).toBe(true);
    const calls = [...jest.mocked(humanPaste).mock.calls, ...jest.mocked(humanType).mock.calls];
    expect(calls).toHaveLength(1);
    expect(calls[0]![2]).toBe(expected);
  });

  test('Tistory thumbnail survives full-document conversion and the shared writer', async () => {
    const prepared = buildTistoryFinalHtml(full, 'https://example.invalid/thumbnail.jpg', '', '제목');
    expect(prepared).toContain(flattened);
    expect(prepared).toContain('https://example.invalid/thumbnail.jpg');
    expect(preservation.flattenDocumentForPost(prepared)).toEqual({ html: prepared, flattened: false });
  });

  test('invalid imported CSS fails before WordPress makes any external request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network must not run'));
    const result = await updateWordPressPost({ postId: 42, content: '<html><head><style>p {</style></head><body><p>본문</p></body></html>' });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
