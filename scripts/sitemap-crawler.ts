
// scripts/sitemap-crawler.ts
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

type Args = {
  domain?: string;
  file?: string;
  category: string;
  country: string;
  cta: string;
  keywords?: string;
  concurrency?: number;
  filter?: string;
  exclude?: string;
};

function parseArgs(): Args {
  const args: any = {};
  const argv = process.argv.slice(2);
  for (let i=0; i<argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const key = k.slice(2);
    const v = argv[i+1] && !argv[i+1].startsWith("--") ? argv[++i] : "true";
    args[key] = v;
  }
  if (!args.category) throw new Error("--category required");
  if (!args.country) throw new Error("--country required");
  if (!args.cta) throw new Error("--cta required");
  return args as Args;
}

function toArrayCSVSafe(x?: string): string[] {
  return (x ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

function sanitizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : "https://" + u.replace(/^\/+/, "");
}

async function fetchText(u: string): Promise<string> {
  const res = await fetch(u, { redirect: "follow" as const });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
  return await res.text();
}

function parseXmlUrls(xml: string): string[] {
  const locRegex = /<loc>([^<]+)<\/loc>/gim;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = locRegex.exec(xml))) out.push(m[1].trim());
  return Array.from(new Set(out));
}

function pickSitemaps(xml: string): string[] {
  const maps: string[] = [];
  const re = /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) maps.push(m[1].trim());
  return maps;
}

async function extractUrlsFromSitemap(root: string): Promise<string[]> {
  const xml = await fetchText(root);
  const children = pickSitemaps(xml);
  if (children.length === 0) return parseXmlUrls(xml);
  let all: string[] = [];
  for (const sm of children) {
    try {
      const subXml = await fetchText(sm);
      all = all.concat(parseXmlUrls(subXml));
      await delay(50);
    } catch {}
  }
  return Array.from(new Set(all));
}

function filterUrls(urls: string[], include?: string[], exclude?: string[]): string[] {
  const inc = include && include.length ? include : undefined;
  const exc = exclude && exclude.length ? exclude : undefined;
  return urls.filter(u => {
    const U = u.toLowerCase();
    if (inc && !inc.some(tok => U.includes(tok.toLowerCase()))) return false;
    if (exc && exc.some(tok => U.includes(tok.toLowerCase()))) return false;
    return true;
  });
}

function toCsvRow(fields: (string|boolean)[]): string {
  const escaped = fields.map(v => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  });
  return escaped.join(",");
}

function hostFrom(u: string): string {
  try { return new URL(u).host; } catch { return u; }
}

async function main() {
  const args = parseArgs();
  const domains: string[] = [];
  if (args.domain) domains.push(args.domain);
  if (args.file) {
    const txt = fs.readFileSync(path.resolve(args.file), "utf-8");
    txt.split(/\r?\n/).forEach(line => { if (line.trim()) domains.push(line.trim()); });
  }
  if (domains.length === 0) throw new Error("No domains. Use --domain or --file");

  const include = toArrayCSVSafe(args.filter);
  const exclude = toArrayCSVSafe(args.exclude);
  const kw = toArrayCSVSafe(args.keywords);
  const cc = Number(args.concurrency || 3);

  const queue = domains.map(sanitizeUrl);
  const outRows: string[] = [];
  let active = 0, idx = 0;

  async function work(d: string) {
    try {
      const sitemap = d.replace(/\/+$/, "") + "/sitemap.xml";
      const all = await extractUrlsFromSitemap(sitemap);
      const filtered = filterUrls(all, include, exclude);
      const name = hostFrom(d);
      for (const u of filtered) {
        outRows.push(toCsvRow([
          name, args.category, args.country, true, u, args.cta, kw.join(" "),
          "leadernam","cta", args.category, "", "", ""
        ]));
      }
      console.error(`[ok] ${d} -> ${filtered.length} urls`);
    } catch (e: any) {
      console.error(`[fail] ${d}: ${e?.message || e}`);
    }
  }

  await new Promise<void>(res => {
    function next() {
      if (idx >= queue.length && active === 0) return res();
      while (active < cc && idx < queue.length) {
        const d = queue[idx++];
        active++;
        work(d).finally(() => { active--; next(); });
      }
    }
    next();
  });

  console.log(outRows.join("\n"));
}
main().catch(e => { console.error(e); process.exit(1); });
