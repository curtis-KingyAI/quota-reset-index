/**
 * Shared page shell and styles for the static site.
 *
 * One stylesheet, inlined into each page. No build step, no framework, no
 * dependencies, and nothing fetched at render time — §8 forbids client-side
 * calls to vendor endpoints, and the simplest way to guarantee that is a page
 * with no network code in it at all.
 */

export const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const STYLES = `
  :root { --ink:#16202a; --soft:#5d6c79; --faint:#8c99a4; --rule:#c7cfd5; --hair:#e6eaed;
          --well:#f6f8f9; --warn:#8a4a12; --warn-bg:#fdf6ee; --link:#2f5aa8;
          --codex:#b4431c; --claude:#3a4e86; --dead:#9aa6ae; }
  *{box-sizing:border-box}
  body { margin:0 auto; max-width:74rem; padding:2rem 1.25rem 5rem;
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); }
  a { color:var(--link) }
  h1 { font-size:2rem; letter-spacing:-.02em; margin:0 0 .25rem }
  h2 { font-size:1.15rem; margin:2.5rem 0 .75rem; padding-bottom:.4rem; border-bottom:1px solid var(--ink) }
  .lede { color:var(--soft); margin:0 0 1.5rem; max-width:60rem }
  nav { display:flex; gap:1.25rem; flex-wrap:wrap; padding:.75rem 0 1.25rem;
        border-bottom:1px solid var(--rule); margin-bottom:1.5rem; font-size:.9rem }
  nav a[aria-current] { font-weight:600; color:var(--ink); text-decoration:none }
  .banner { border:2px solid var(--warn); background:var(--warn-bg); color:var(--warn);
            padding:.9rem 1.05rem; margin:1.25rem 0; font-weight:600; font-size:.92rem }
  .banner p { margin:.45rem 0 0; font-weight:400; color:var(--ink) }
  code { background:var(--well); border:1px solid var(--hair); padding:.05rem .3rem; font-size:.88em }
  pre { background:var(--well); border:1px solid var(--rule); padding:.9rem 1rem;
        overflow-x:auto; font-size:.85rem; line-height:1.5 }
  table { width:100%; border-collapse:collapse; margin:1rem 0; font-size:.9rem }
  th { text-align:left; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase;
       color:var(--soft); border-bottom:1px solid var(--rule); padding:0 .5rem .4rem 0 }
  td { padding:.5rem .5rem .5rem 0; border-bottom:1px solid var(--hair); vertical-align:top }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; padding-right:1.25rem }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--rule);
           color:var(--soft); font-size:.85rem }
  .pill { display:inline-block; font-size:.68rem; letter-spacing:.06em; text-transform:uppercase;
          padding:.1rem .4rem; border:1px solid var(--rule); border-radius:2px; color:var(--soft);
          white-space:nowrap }
  .pill.codex { border-color:var(--codex); color:var(--codex) }
  .pill.claude-code { border-color:var(--claude); color:var(--claude) }
  .pill.confirmed { border-color:#2b6b3f; color:#2b6b3f }
  .pill.superseded { border-color:var(--dead); color:var(--dead) }
  /* field_support markers — the whole point is that they are visually distinct */
  .sup { font-size:.7rem; letter-spacing:.04em; text-transform:uppercase; margin-left:.35rem }
  .sup-attested { color:#2b6b3f }
  .sup-inferred { color:var(--warn) }
  .sup-unestablished { color:var(--faint); font-style:italic }
  .unset { color:var(--faint); font-style:italic }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e6eaed; --soft:#9fb0bd; --faint:#7b8894; --rule:#3a4750; --hair:#252d34;
            --well:#1b2229; --warn:#e0a35c; --warn-bg:#241c11; --link:#7ba7e8;
            --codex:#e08055; --claude:#8aa3e0; --dead:#5f6b74; }
    body { background:#121417 }
    .pill.confirmed { border-color:#6fbf8a; color:#6fbf8a }
    .sup-attested { color:#6fbf8a }
  }
`;

/**
 * NOINDEX DEFAULTS TO ON, and is disabled only by an explicit opt-in.
 *
 * The staging origin (<project>.pages.dev) must never be indexed: an indexed
 * staging URL is a stranded URL the moment the custom domain lands, and the
 * project doctrine is to 301 before changing status — which you cannot do for a
 * URL you did not mean to publish. Defaulting to indexable and remembering to
 * turn it off is the wrong way round; forgetting the flag would be the failure.
 *
 * To build an indexable site once the custom domain resolves:
 *   QRI_INDEXABLE=1 npm run build
 */
export const NOINDEX = process.env.QRI_INDEXABLE !== '1';

export interface PageOptions {
  title: string;
  current: 'ledger' | 'forecast' | 'methodology';
  body: string;
  extraStyles?: string;
  script?: string;
}

// Cloudflare Pages serves /x.html but 308-redirects it to /x, so the
// extensionless form is canonical. Linking to .html would cost a redirect
// round-trip on every internal click — verified against the live origin.
const NAV = [
  { href: '/', label: 'Ledger', key: 'ledger' },
  { href: '/forecast', label: 'Forecast', key: 'forecast' },
  { href: '/methodology', label: 'Methodology', key: 'methodology' },
];

export function page(o: PageOptions): string {
  const nav = NAV.map(
    (n) => `<a href="${n.href}"${n.key === o.current ? ' aria-current="page"' : ''}>${n.label}</a>`,
  ).join('\n  ');

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${NOINDEX ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<title>${esc(o.title)}</title>
<style>${STYLES}${o.extraStyles ?? ''}</style>

<nav>
  ${nav}
  <a href="/ledger.json">ledger.json</a>
  <a href="/ledger.csv">ledger.csv</a>
</nav>

${o.body}

<footer>
Quota Reset Index · a sourced, append-only record of discretionary AI quota resets.
Data at <a href="/ledger.json">/ledger.json</a> and <a href="/ledger.csv">/ledger.csv</a>, CORS-open —
see <a href="/methodology#data">Methodology</a>. Corrections welcome against the evidence.
</footer>
${o.script ? `<script>\n${o.script}\n</script>` : ''}
</html>
`;
}
