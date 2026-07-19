const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('image placement mode synchronization', () => {
  test('main image UI forces H2 off for thumbnail-only and both engines off for none', () => {
    const script = read('electron/ui/script.js');

    expect(script).toContain('window.syncImagePlacementMode = function');
    expect(script).toContain("if (mode === 'none')");
    expect(script).toContain('_setPlacementForcedNone(thumbnailSelect, true)');
    expect(script).toContain("} else if (mode === 'thumbnail-only')");
    expect(script).toContain('_setPlacementForcedNone(h2Select, true)');
  });

  test('posting and generation core enforce the mode even if stale engine values remain', () => {
    const posting = read('electron/ui/modules/posting.js');
    const orchestration = read('src/core/final/orchestration.ts');

    expect(posting).toContain("const forceH2None = selectedPolicy === 'thumbnail-only' || selectedPolicy === 'none'");
    expect(posting).toContain("const effectiveThumbnailModeValue = h2ImageSettings.imagePolicy === 'none' ? 'none'");
    expect(orchestration).toContain("const skipImages = payload.skipImages === true || h2ImageMode === 'none'");
    expect(orchestration).toContain("(h2ImageMode === 'thumbnail-only' || h2ImageMode === 'none')");
  });
});
