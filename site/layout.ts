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
  /* 112.5% root = 18px base. One lever scales every rem-based size at
     once; the individual floors below were also raised because a dense
     table still read too small at 16px. Nothing is under ~14px now. */
  html { font-size: 112.5% }
  :root { --ink:#16202a; --soft:#5d6c79; --faint:#8c99a4; --rule:#c7cfd5; --hair:#e6eaed;
          --well:#f6f8f9; --warn:#8a4a12; --warn-bg:#fdf6ee; --link:#2f5aa8;
          --codex:#b4431c; --claude:#3a4e86; --dead:#9aa6ae; }
  *{box-sizing:border-box}
  body { margin:0 auto; max-width:74rem; padding:2rem 1.25rem 5rem;
         font:1rem/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); }
  a { color:var(--link) }
  h1 { font-size:2rem; letter-spacing:-.02em; margin:0 0 .25rem }
  h2 { font-size:1.2rem; margin:2.5rem 0 .75rem; padding-bottom:.4rem; border-bottom:1px solid var(--ink) }
  .lede { color:var(--soft); margin:0 0 1.5rem; max-width:60rem }
  nav { display:flex; gap:1.25rem; flex-wrap:wrap; padding:.75rem 0 1.25rem;
        border-bottom:1px solid var(--rule); margin-bottom:1.5rem; font-size:.95rem }
  nav a[aria-current] { font-weight:600; color:var(--ink); text-decoration:none }
  .banner { border:2px solid var(--warn); background:var(--warn-bg); color:var(--warn);
            padding:.9rem 1.05rem; margin:1.25rem 0; font-weight:600; font-size:.95rem }
  .banner p { margin:.45rem 0 0; font-weight:400; color:var(--ink) }
  code { background:var(--well); border:1px solid var(--hair); padding:.05rem .3rem; font-size:.92em }
  pre { background:var(--well); border:1px solid var(--rule); padding:.9rem 1rem;
        overflow-x:auto; font-size:.95rem; line-height:1.5 }
  table { width:100%; border-collapse:collapse; margin:1rem 0; font-size:.95rem }
  th { text-align:left; font-size:.95rem; letter-spacing:.08em; text-transform:uppercase;
       color:var(--soft); border-bottom:1px solid var(--rule); padding:0 .5rem .4rem 0 }
  td { padding:.5rem .5rem .5rem 0; border-bottom:1px solid var(--hair); vertical-align:top }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; padding-right:1.25rem }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--rule);
           color:var(--soft); font-size:.95rem }
  .pill { display:inline-block; font-size:.8rem; letter-spacing:.06em; text-transform:uppercase;
          padding:.1rem .4rem; border:1px solid var(--rule); border-radius:2px; color:var(--soft);
          white-space:nowrap }
  .pill.codex { border-color:var(--codex); color:var(--codex) }
  .pill.claude-code { border-color:var(--claude); color:var(--claude) }
  .pill.confirmed { border-color:#2b6b3f; color:#2b6b3f }
  .pill.superseded { border-color:var(--dead); color:var(--dead) }
  /* field_support markers — the whole point is that they are visually distinct */
  .sup { font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; margin-left:.35rem }
  .sup-attested { color:#2b6b3f }
  .sup-inferred { color:var(--warn) }
  .sup-unestablished { color:var(--faint); font-style:italic }
  .unset { color:var(--faint); font-style:italic }
  /* Forecast hero. Large enough to be the first thing read, with the caveat
     inside the same bordered block so the two cannot be visually divorced. */
  .hero { border:2px solid var(--ink); margin:0 0 2rem; padding:1.1rem 1.3rem 1rem }
  .hero-head { font-size:.92rem; letter-spacing:.08em; text-transform:uppercase;
               color:var(--soft); margin-bottom:.75rem }
  .hero-nums { display:flex; gap:2.5rem; flex-wrap:wrap; align-items:flex-start }
  .hero-num { display:flex; flex-direction:column; line-height:1 }
  .hero-num b { font-size:3.4rem; font-weight:700; letter-spacing:-.03em; font-variant-numeric:tabular-nums }
  .hero-num span { font-size:.92rem; color:var(--soft); margin-top:.4rem; max-width:16rem; line-height:1.35 }
  .hero-num em { display:block; font-size:.82rem; font-style:italic; color:var(--faint) }
  .hero-num.codex b { color:var(--codex) }
  .hero-num.claude b { color:var(--claude) }
  .hero-num.sched b { color:var(--soft); font-size:2.4rem }
  .hero-caveat { margin:1rem 0 0; padding-top:.8rem; border-top:1px solid var(--rule);
                 font-size:.92rem; color:var(--ink) }
  @media (max-width:640px) { .hero-nums { gap:1.5rem } .hero-num b { font-size:2.6rem } }
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
 * Indexability. DEFAULT FLIPPED 2026-07-27 — the reasoning that justified the
 * old default expired, so the default had to change with it.
 *
 * It previously defaulted to NOINDEX because the only live origin was a staging
 * hostname, and an indexed staging URL is stranded the moment the real domain
 * lands. That argument was correct then and is spent now: ledger.kingy.ai is
 * live, canonical, and linked from the kingy.ai main nav. Keeping the old
 * default would mean the site's real home ships telling crawlers to ignore it —
 * failing safe in the direction that makes the project pointless.
 *
 * Opt OUT for a preview build:
 *   QRI_NOINDEX=1 npm run build
 *
 * Note the pairing: whenever this is indexable, every page also emits a
 * canonical link to CANONICAL_ORIGIN, because the same bytes are served from
 * two hostnames and only one of them should win.
 */
export const NOINDEX = process.env.QRI_NOINDEX === '1';

/**
 * The canonical origin.
 *
 * ⚠️ REQUIRED ONCE THE SITE IS INDEXABLE. The same bytes are served from TWO
 * hostnames — ledger.kingy.ai (canonical) and quota-reset-index.pages.dev (the
 * Cloudflare Pages origin, which cannot be switched off). Without a canonical
 * link every page exists twice to a crawler, splitting whatever authority it
 * earns and letting the wrong hostname win. The tag is emitted on both origins
 * and points at the canonical one from both, which is what resolves it.
 */
export const CANONICAL_ORIGIN = 'https://ledger.kingy.ai';


/**
 * The forecast hero — rendered at the top of EVERY page.
 *
 * Operator decision 2026-07-27: the forecast is what people come for, so it
 * leads rather than sitting one click away.
 *
 * ⚠️ THE CAVEAT TRAVELS WITH THE NUMBERS, AND THAT IS NOT DECORATION. §7.3
 * requires the calibration status adjacent to any rendered forecast number and
 * not hidden. Promoting these figures to the most prominent element on every
 * page makes that requirement MORE binding, not less: a large percentage reads
 * as authoritative, and this one has never been checked against a single
 * outcome. So the hero is built as one unit — numbers and status cannot be
 * separated by editing a template, because they are emitted by the same
 * function, and a test asserts the status string appears on every page.
 */
export function forecastHero(f: {
  codex: number;
  claude: number;
  windowHours: number;
  scheduled: number;
}): string {
  return `
<section class="hero" aria-label="Forecast summary">
  <div class="hero-head">Chance of a discretionary quota reset in the next ${f.windowHours} hours</div>
  <div class="hero-nums">
    <div class="hero-num codex"><b>${f.codex}%</b><span>Codex</span></div>
    <div class="hero-num claude"><b>${f.claude}%</b><span>Claude Code</span></div>
    <div class="hero-num sched"><b>${f.scheduled}%</b><span>Claude Code scheduled recycle<em>counted separately — do not add</em></span></div>
  </div>
  <p class="hero-caveat"><strong>Uncalibrated.</strong> These are hand-set priors from the public
  event record, not fitted parameters, and none has been checked against an outcome. There is no
  accuracy score behind them yet. <a href="/forecast">How they are built</a> ·
  <a href="/methodology">why they may be wrong</a>.</p>
</section>`;
}

export interface PageOptions {
  title: string;
  /** Path this page is served at, for the canonical link. */
  path?: string;
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
${NOINDEX ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${CANONICAL_ORIGIN}${o.path ?? '/'}">
<title>${esc(o.title)}</title>
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
