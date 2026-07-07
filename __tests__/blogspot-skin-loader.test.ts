import { loadSkinCSS } from '../electron/oneclick/utils/skinLoader';

describe('Blogspot skin loader', () => {
  test('loads the Leadernam Blogspot cloud skin CSS from the UI assets', () => {
    const css = loadSkinCSS('blogspot');

    expect(css.length).toBeGreaterThan(1000);
    expect(css).toContain('.blogspot-cloud-skin');
  });

  test('loads the Blogspot approval revenue skin CSS from the UI assets', () => {
    const css = loadSkinCSS('blogspot-approval');

    expect(css.length).toBeGreaterThan(1000);
    expect(css).toContain('LEADERNAM_APPROVAL_REVENUE_SKIN_V1');
    expect(css).toContain('LEADERNAM_APPROVAL_REVENUE_SKIN_V2');
    expect(css).toContain('.leadernam-ad-slot');
    expect(css).toContain('.leadernam-proof-strip');
  });
});
