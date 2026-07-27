/**
 * Emits public/robots.txt. Mirrors the NOINDEX default in layout.ts — the two
 * must agree, or a crawler gets one answer from the meta tag and another from
 * robots.txt.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ORIGIN, NOINDEX } from './layout.ts';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const renderRobots = (): string =>
  NOINDEX
    ? `# Staging origin — not the canonical home for this project.
# Disallowed so no URL here is indexed and later stranded when the custom
# domain lands. Rebuild with QRI_INDEXABLE=1 to publish an indexable site.
User-agent: *
Disallow: /
`
    : `User-agent: *
Allow: /

Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml
`;

function main(): void {
  const out = join(ROOT, 'public');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'robots.txt'), renderRobots());
  console.log(`built public/robots.txt (${NOINDEX ? 'noindex' : 'INDEXABLE'})`);
}

if (isMain(import.meta.url)) main();
