/**
 * Runs the renderer's ES modules (electron/ui/modules/*.js) as they are on disk, inside a vm sandbox.
 *
 * The renderer code is plain browser ESM, which jest (CommonJS) cannot import. Instead of copying logic into
 * the test, this loader rewrites only the module syntax with acorn (imports become destructuring from the
 * stub/real module registry, `export` keywords are dropped) and evaluates the original source text.
 * Nothing here touches a browser, an agent CLI, a network or a publishing platform.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const acorn = require('acorn');

export type ModuleExports = Record<string, any>;

export interface EsmLoaderOptions {
  /** the vm context every module is evaluated in (it already holds window, document, ...) */
  context: vm.Context;
  /** exports to use instead of the file, keyed by the file's basename (e.g. "core.js") */
  stubs: Record<string, ModuleExports>;
}

function declaredNames(declaration: any): string[] {
  if (!declaration) return [];
  if (declaration.id?.name) return [declaration.id.name];
  if (declaration.type === 'VariableDeclaration') {
    return declaration.declarations.flatMap((d: any) => (d.id?.name ? [d.id.name] : []));
  }
  return [];
}

export function createEsmLoader({ context, stubs }: EsmLoaderOptions) {
  const cache = new Map<string, ModuleExports>();

  function load(file: string): ModuleExports {
    const base = path.basename(file);
    if (stubs[base]) return stubs[base];
    const abs = path.resolve(file);
    const hit = cache.get(abs);
    if (hit) return hit;

    const source = fs.readFileSync(abs, 'utf8');
    const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const edits: Array<{ start: number; end: number; text: string }> = [];
    const exported: string[] = [];

    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const target = load(path.resolve(path.dirname(abs), node.source.value));
        const key = `__mod_${cache.size}_${edits.length}`;
        (context as any)[key] = target;
        const parts = node.specifiers.map((s: any) => (s.imported
          ? (s.imported.name === s.local.name ? s.local.name : `${s.imported.name}: ${s.local.name}`)
          : s.local.name));
        edits.push({ start: node.start, end: node.end, text: parts.length ? `const { ${parts.join(', ')} } = ${key};` : '' });
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          exported.push(...declaredNames(node.declaration));
          edits.push({ start: node.start, end: node.declaration.start, text: '' });
        } else {
          exported.push(...node.specifiers.map((s: any) => s.local.name));
          edits.push({ start: node.start, end: node.end, text: '' });
        }
      }
    }

    let code = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
    }
    const wrapped = `(function () {\n${code}\nreturn { ${[...new Set(exported)].join(', ')} };\n})()`;
    const exports = vm.runInContext(wrapped, context, { filename: abs }) as ModuleExports;
    cache.set(abs, exports);
    return exports;
  }

  return { load };
}
