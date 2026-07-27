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
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PATHS = ['/', '/forecast', '/methodology'];

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
  // Date only, and taken from the build, so the file stays deterministic within a day.
  writeFileSync(join(out, 'sitemap.xml'), renderSitemap(new Date().toISOString().slice(0, 10)));
  console.log('built public/sitemap.xml');
}

if (isMain(import.meta.url)) main();
