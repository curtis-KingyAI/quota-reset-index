/**
 * Emits public/sitemap.xml and wires it into robots.txt.
 *
 * Only meaningful once the site is indexable, and only ever lists the CANONICAL
 * origin — a sitemap advertising the pages.dev hostname would work against the
 * canonical tags it sits beside.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ORIGIN, NOINDEX } from './layout.ts';
import { codexLiveState } from './live-state.ts';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PATHS = ['/', '/forecast', '/methodology', '/compare'];

export const renderSitemap = (lastmod: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  PATHS.map((p) => `  <url><loc>${CANONICAL_ORIGIN}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n') +
  `\n</urlset>\n`;

function main(): void {
  if (NOINDEX) {
    console.log('skipped sitemap.xml (site is noindex)');
    return;
  }
  const out = join(ROOT, 'public');
  mkdirSync(out, { recursive: true });

  // ⚠️ `lastmod` COMES FROM THE LEDGER, NOT THE CLOCK. This used to be
  // `new Date().toISOString().slice(0, 10)`, described as "deterministic within a
  // day" — which is another way of saying NOT deterministic, and §4.4 requires
  // byte-identical output from identical inputs.
  //
  // The practical cost was a scheduled false alarm: CI rebuilds and fails on any
  // diff in public/, so the first push after every UTC midnight would fail on a
  // sitemap nobody had touched. A CI job that cries wolf daily is a CI job people
  // learn to re-run without reading, which is how a real failure gets waved past.
  //
  // The ledger's own AS_OF is also the semantically correct value: `lastmod` should
  // say when the CONTENT last changed, and the content is the ledger. A build on a
  // new day changes nothing a crawler cares about.
  writeFileSync(join(out, 'sitemap.xml'), renderSitemap(codexLiveState().asOfIso.slice(0, 10)));
  console.log('built public/sitemap.xml');
}

if (isMain(import.meta.url)) main();
