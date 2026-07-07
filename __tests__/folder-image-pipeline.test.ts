const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('folder image H2 mapping pipeline', () => {
  test('folder mapper stores explicit h2Index/dataUrl mappings instead of local file paths', () => {
    const script = read('electron/ui/script.js');

    expect(() => acorn.parse(script, {
      ecmaVersion: 'latest',
      sourceType: 'script',
    })).not.toThrow();
    expect(script).toContain("window.electronAPI.invoke('select-image-folder')");
    expect(script).toContain("window.electronAPI.invoke('read-local-image-data-url', image.path)");
    expect(script).toContain('h2Index: section.index');
    expect(script).toContain('dataUrl: image.dataUrl');
    expect(script).toContain('sourcePath: image.sourcePath ||');
    expect(script).toContain('window.__preGeneratedImagesForArticle = mapping');
    expect(script).toContain('window.__folderImageMissingPolicy = policy');
  });

  test('posting, spider, and queue payloads forward folder image mappings', () => {
    const posting = read('electron/ui/modules/posting.js');
    const internalLinks = read('electron/ui/modules/internal-links.js');
    const queue = read('electron/ui/modules/publish-queue.js');

    for (const source of [posting, internalLinks, queue]) {
      expect(source).toContain('preGeneratedImages');
      expect(source).toContain('h2Index: img.h2Index');
      expect(source).toContain('dataUrl: img.dataUrl');
      expect(source).toContain('folderImageMissingPolicy');
    }
  });

  test('API and spider generators prefer mapped folder images by H2 number', () => {
    const orchestration = read('src/core/final/orchestration.ts');
    const main = read('electron/main.ts');

    expect(orchestration).toContain('Number(p?.h2Index) === h2Number');
    expect(orchestration).toContain('return { dataUrl: preGenMatch.dataUrl');
    expect(orchestration).toContain('folderImageMissingPolicy');
    expect(orchestration).toContain('uploadBase64ToImageHost(img');

    expect(main).toContain("ipcMain.handle('select-image-folder'");
    expect(main).toContain("ipcMain.handle('read-local-image-data-url'");
    expect(main).toContain('Number(img?.h2Index) === idx1');
    expect(main).toContain("_hostGeneratedImage(rawH2, `sw-folder-h2-${idx1}`)");
  });

  test('agent mode also uses mapped folder images before generating new images', () => {
    const workshop = read('electron/ui/modules/codex-workshop.js');

    expect(workshop).toContain('function getPreGeneratedH2Image');
    expect(workshop).toContain('const folderImage = getPreGeneratedH2Image(payload, index)');
    expect(workshop).toContain('let imageUrl = String(folderImage?.dataUrl || folderImage?.url ||');
    expect(workshop).toContain('shouldLeaveUnmappedFolderImageBlank(payload)');
    expect(workshop).toContain("figure.setAttribute('data-agent-image', isFolderImage ? 'folder' : 'generated')");
  });
});
