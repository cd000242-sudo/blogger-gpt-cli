// Check the actual Windows release payload and auto-update digest before upload.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

(async () => {
  const asar = await import('@electron/asar');
  const root = path.resolve(__dirname, '..');
  const version = require('../package.json').version;
  const archive = path.join(root, 'release/win-unpacked/resources/app.asar');
  const metadata = yaml.load(fs.readFileSync(path.join(root, 'release/latest.yml'), 'utf8'));
  assert.equal(metadata.version, version);
  const exeName = `LEADERNAM-Orbit-${version}.exe`;
  assert.equal(metadata.path, exeName);
  const exePath = path.join(root, 'release', exeName);
  const hash = crypto.createHash('sha512');
  for await (const chunk of fs.createReadStream(exePath)) hash.update(chunk);
  const sha512 = hash.digest('base64');
  assert.equal(metadata.sha512, sha512);
  const file = metadata.files.find(item => item.url === exeName);
  assert(file);
  assert.equal(file.sha512, sha512);
  assert.equal(file.size, fs.statSync(exePath).size);
  assert(fs.statSync(exePath + '.blockmap').size > 0);
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).version, version);
  const modules = [
    'electron/main.js', 'electron/windows-browser-process.js',
    'electron/ui/modules/editor.js', 'electron/ui/modules/editor-images.js',
    'electron/ui/modules/editor-image-plan.js', 'electron/ui/modules/editor-workspace.js',
    'dist/core/final/editor-image.js', 'dist/core/imageDispatcher.js',
    'dist/core/final/post-critique.js', 'dist/thumbnail.js',
  ];
  for (const module of modules) {
    assert(asar.extractFile(archive, path.normalize(module)).equals(fs.readFileSync(path.join(root, module))), `${module} differs from the verified workspace`);
  }
  console.log(`PASS v${version}: installer SHA-512/size, blockmap, package version and ${modules.length} packaged modules match.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
