/**
 * Page shell and design system.
 *
 * DESIGN INTENT, recorded so future changes have something to argue against:
 * this is a public REGISTER, not a dashboard. The reference points are financial
 * and statistical publications — a ratings register, a statistical yearbook —
 * where the job is to make dense, checkable material legible and to look like it
 * can be trusted. Hence confident typographic hierarchy, generous whitespace,
 * hairline rules rather than boxes, and exactly one accent colour per vendor.
 *
 * It explicitly does NOT mean gradients, cards, shadows or decoration. Ornament
 * on a page whose entire claim is "check our work" reads as compensation.
 *
 * Everything is inlined and self-contained. §8 forbids client-side calls to
 * vendor endpoints, and a page that makes no external request at all cannot
 * violate it.
 */

export const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Indexability. Default is INDEXABLE. The old noindex default existed to protect
 * a staging-only origin and was retired once ledger.kingy.ai went live.
 * Opt out for a preview build with QRI_NOINDEX=1.
 */
export const NOINDEX = process.env.QRI_NOINDEX === '1';

/**
 * The canonical origin. The same bytes are served from ledger.kingy.ai and from
 * quota-reset-index.pages.dev, which cannot be switched off — so every page
 * declares its canonical path from BOTH origins and the right hostname wins.
 */
export const CANONICAL_ORIGIN = 'https://ledger.kingy.ai';

export const STYLES = `
  /* 112.5% root = 18px. One lever scales every rem-based size; individual
     floors are set below so nothing lands under ~14px on a dense table. */
  html { font-size:112.5%; -webkit-text-size-adjust:100% }

  :root {
    --ink:#12161a; --ink-2:#3d4750; --soft:#606d78; --faint:#8d98a3;
    --rule:#dcd8d1; --hair:#ebe8e2; --paper:#fbfaf8; --well:#f4f2ee;
    --warn:#8a4a12; --warn-bg:#fdf4e8; --link:#1f4f96;
    --codex:#a83d17; --claude:#33477d; --dead:#9aa6ae; --good:#2a6b41;
    --measure:38rem;
  }
  *{box-sizing:border-box}
  body {
    margin:0; background:var(--paper); color:var(--ink);
    font:1rem/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;
    font-feature-settings:"kern" 1,"liga" 1; text-rendering:optimizeLegibility;
  }
  .shell { max-width:78rem; margin:0 auto; padding:0 1.5rem 6rem }
  a { color:var(--link); text-underline-offset:.15em }

  /* ---------- masthead ---------- */
  .masthead { border-bottom:2px solid var(--ink); padding:1.4rem 0 .9rem; margin-bottom:2rem }
  .masthead-top { display:flex; align-items:baseline; justify-content:space-between; gap:1.5rem; flex-wrap:wrap }
  .wordmark { font-size:1.12rem; font-weight:700; letter-spacing:-.015em; color:var(--ink);
              text-decoration:none; white-space:nowrap }
  .wordmark span { color:var(--codex) }
  .masthead nav { display:flex; gap:1.4rem; flex-wrap:wrap; font-size:.95rem }
  .masthead nav a { color:var(--ink-2); text-decoration:none; padding-bottom:.15rem;
                    border-bottom:2px solid transparent }
  .masthead nav a:hover { border-bottom-color:var(--rule) }
  .masthead nav a[aria-current] { color:var(--ink); font-weight:600; border-bottom-color:var(--ink) }
  .masthead-sub { margin:.55rem 0 0; font-size:.9rem; color:var(--soft); max-width:52rem }

  /* ---------- type ---------- */
  h1 { font-size:clamp(2.1rem,4.2vw,2.85rem); line-height:1.08; letter-spacing:-.028em;
       font-weight:700; margin:0 0 .6rem }
  h2 { font-size:1.28rem; letter-spacing:-.012em; font-weight:650; margin:3rem 0 .9rem;
       padding-bottom:.45rem; border-bottom:1px solid var(--rule) }
  h3 { font-size:1.02rem; font-weight:650; margin:1.9rem 0 .5rem }
  p { margin:0 0 1rem }
  .lede { color:var(--ink-2); font-size:1.06rem; line-height:1.62; max-width:54rem; margin:0 0 1.5rem }
  code { background:var(--well); border:1px solid var(--hair); border-radius:2px;
         padding:.06rem .32rem; font-size:.9em; font-family:ui-monospace,SFMono-Regular,Menlo,monospace }
  pre { background:var(--well); border:1px solid var(--rule); border-radius:3px; padding:1rem 1.15rem;
        overflow-x:auto; font-size:.9rem; line-height:1.55;
        font-family:ui-monospace,SFMono-Regular,Menlo,monospace }

  /* ---------- hero ---------- */
  .hero { border:1px solid var(--rule); border-top:4px solid var(--ink); border-radius:2px;
          background:#fff; margin:0 0 2.4rem; padding:1.35rem 1.5rem 1.15rem }
  .hero-head { font-size:.78rem; letter-spacing:.13em; text-transform:uppercase; font-weight:650;
               color:var(--soft); margin-bottom:1.1rem }
  .hero-nums { display:flex; gap:3.2rem; flex-wrap:wrap; align-items:flex-start }
  .hero-num { display:flex; flex-direction:column; line-height:1 }
  .hero-num b { font-size:4rem; font-weight:700; letter-spacing:-.045em;
                font-variant-numeric:tabular-nums; line-height:.92 }
  .hero-num span { font-size:.9rem; color:var(--ink-2); margin-top:.55rem; max-width:15rem;
                   line-height:1.35; font-weight:550 }
  .hero-num em { display:block; font-size:.82rem; font-style:normal; color:var(--faint);
                 font-weight:400; margin-top:.15rem }
  .hero-num.codex b { color:var(--codex) }
  .hero-num.claude b { color:var(--claude) }
  .hero-num.sched b { color:var(--soft); font-size:2.6rem }
  .hero-caveat { margin:1.35rem 0 0; padding-top:.9rem; border-top:1px solid var(--hair);
                 font-size:.9rem; color:var(--ink-2); max-width:52rem }
  .hero-caveat strong { color:var(--warn) }
  /* Freshness. Escalated client-side against the reader's clock — see hero-script.ts.
     The base state is deliberately quiet: a maintained ledger should not shout. */
  .freshness { margin:.2rem 0 .2rem; font-size:.85rem; line-height:1.5; color:var(--faint); max-width:56rem }
  .freshness.warn { color:var(--warn); font-weight:600 }
  .freshness.bad { color:var(--warn); font-weight:650; background:var(--warn-bg);
                   border-left:3px solid var(--warn); padding:.6rem .8rem; border-radius:0 2px 2px 0 }
  .hero-asof { margin:1.1rem 0 .2rem; font-size:.85rem; line-height:1.55; color:var(--faint); max-width:56rem }
  .hero-asof strong { color:var(--ink-2); font-weight:600 }
  .hero-asof em { font-style:normal; color:var(--ink-2) }

  /* ---------- notices ---------- */
  .banner { border-left:3px solid var(--warn); background:var(--warn-bg); border-radius:0 2px 2px 0;
            padding:.95rem 1.15rem; margin:1.4rem 0; font-size:.94rem; max-width:54rem }
  .banner-lead { display:block; font-weight:650; color:var(--warn); margin-bottom:.35rem }
  .banner p { margin:0; color:var(--ink-2); font-weight:400 }
  .banner p strong { font-weight:650; color:var(--ink) }

  /* ---------- tables ---------- */
  table { width:100%; border-collapse:collapse; margin:1.1rem 0; font-size:.95rem }
  th { text-align:left; font-size:.74rem; letter-spacing:.09em; text-transform:uppercase; font-weight:650;
       color:var(--soft); border-bottom:1px solid var(--ink); padding:0 .7rem .5rem 0 }
  td { padding:.7rem .7rem .7rem 0; border-bottom:1px solid var(--hair); vertical-align:top }
  tbody tr:hover td { background:#fff }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; padding-right:1.3rem }

  /* ---------- pills & provenance ---------- */
  .pill { display:inline-block; font-size:.7rem; letter-spacing:.07em; text-transform:uppercase;
          font-weight:650; padding:.14rem .42rem; border:1px solid var(--rule); border-radius:2px;
          color:var(--soft); white-space:nowrap; background:#fff }
  .pill.codex { border-color:var(--codex); color:var(--codex) }
  .pill.claude-code { border-color:var(--claude); color:var(--claude) }
  .pill.confirmed { border-color:var(--good); color:var(--good) }
  .pill.superseded { border-color:var(--dead); color:var(--dead) }
  .sup { font-size:.68rem; letter-spacing:.06em; text-transform:uppercase; font-weight:650;
         margin-left:.32rem; border-bottom:1px dotted currentColor; cursor:help }
  .sup-attested { color:var(--good) }
  .sup-inferred { color:var(--warn) }
  .sup-unestablished { color:var(--faint) }
  .unset { color:var(--faint); font-style:italic }

  footer { margin-top:4rem; padding-top:1.2rem; border-top:1px solid var(--rule);
           color:var(--soft); font-size:.9rem; max-width:54rem }

  @media (prefers-color-scheme: dark) {
    :root {
      --ink:#e9ecef; --ink-2:#b9c2ca; --soft:#8e9aa5; --faint:#6d7883;
      --rule:#333c45; --hair:#242c34; --paper:#0f1216; --well:#181d23;
      --warn:#e0a35c; --warn-bg:#241b0f; --link:#7fa9ea;
      --codex:#e58054; --claude:#8ea6de; --dead:#5f6b74; --good:#68bd88;
    }
    .hero, .pill, tbody tr:hover td { background:#151a20 }
  }
  @media (max-width:820px) {
    .hero-nums { gap:1.8rem } .hero-num b { font-size:2.9rem }
    .shell { padding:0 1.1rem 4rem }
  }
`;

/**
 * The forecast hero — rendered at the top of EVERY page.
 *
 * Operator decision 2026-07-27: the forecast is what people come for, so it leads.
 *
 * ⚠️ THE CAVEAT IS PART OF THIS COMPONENT, DELIBERATELY. §7.3 requires the
 * calibration status adjacent to any rendered forecast number and not hidden.
 * Promoting these to the largest thing on every page makes that bind harder, not
 * softer: a 4rem percentage reads as authoritative and none has been checked
 * against an outcome. Numbers and status are emitted together so a template edit
 * cannot separate them, and a test asserts it on all three pages.
 */
export function forecastHero(f: {
  codex: number;
  claude: number;
  windowHours: number;
  scheduled: number;
  live?: {
    lastResetIso: string;
    asOfIso: string;
    prior: number;
    sinceLabel: string;
    recentResetIsos: string[];
    coverage: { earliest: string; latest: string; label: string };
    /** Later of the ledger's as-of and the last recorded sweep. See lib/sweeps.mjs. */
    reviewedIso: string;
    staleDays: number;
    abandonedDays: number;
  };
}): string {
  const live = f.live;
  return `
<section class="hero" aria-label="Forecast summary"${
    live
      ? ` data-last-reset="${live.lastResetIso}" data-prior="${live.prior}" data-window="${f.windowHours}"` +
        ` data-resets="${esc(JSON.stringify(live.recentResetIsos))}"` +
        ` data-reviewed="${live.reviewedIso}" data-stale-days="${live.staleDays}"` +
        ` data-abandoned-days="${live.abandonedDays}"`
      : ''
  }>
  <div class="hero-head">Chance of a discretionary quota reset · next ${f.windowHours} hours</div>
  <div class="hero-nums">
    <div class="hero-num codex"><b id="cx-pct">${f.codex}%</b><span>Codex<em id="cx-since">${
      live ? `last reset ${live.sinceLabel} · ${live.prior} in the past fortnight` : ''
    }</em></span></div>
    <div class="hero-num claude"><b>${f.claude}%</b><span>Claude Code<em>from a stated baseline — not measured</em></span></div>
    <div class="hero-num sched"><b>${f.scheduled}%</b><span>Claude Code scheduled recycle<em>counted separately — do not add</em></span></div>
  </div>
  ${live ? `<p class="hero-asof">Ledger covers <strong>${live.coverage.label}</strong> ·
  last updated <time datetime="${live.asOfIso}">${live.asOfIso.slice(0, 16).replace('T', ' ')} UTC</time> ·
  the Codex figure is re-reckoned against your clock on load, so it is never the frozen build-time
  number. If a reset happened that this ledger has not recorded yet, the figure reads
  <em>low</em>, not high.</p>
  <p class="freshness" id="freshness">Last reviewed <time datetime="${live.reviewedIso}">${live.reviewedIso.slice(0, 10)}</time>.</p>` : ''}
  <p class="hero-caveat"><strong>Uncalibrated.</strong> These are hand-set priors from the public
  event record, not fitted parameters, and none has been checked against an outcome. There is no
  accuracy score behind them yet. The Codex figure is derived from
  <a href="/">this ledger's own record</a> of when resets actually happened and updates as time
  passes; the Claude Code figure comes from a stated baseline, because no supported channel exposes
  its usage state. <a href="/forecast">How they are built</a> ·
  <a href="/methodology">why they may be wrong</a>.</p>
</section>`;
}

export interface PageOptions {
  title: string;
  path?: string;
  current: 'ledger' | 'forecast' | 'methodology' | 'compare';
  /** Coverage span, e.g. "March–July 2026". Shown in the masthead. */
  coverage?: string;
  body: string;
  /** Fully-formed <head> metadata from seo.ts. */
  head?: string;
  extraStyles?: string;
  script?: string;
}

// Cloudflare Pages serves /x.html but 308-redirects it to /x, so the
// extensionless form is canonical. Linking to .html costs a redirect round-trip
// on every internal click — verified against the live origin.
const NAV = [
  { href: '/', label: 'Ledger', key: 'ledger' },
  { href: '/forecast', label: 'Forecast', key: 'forecast' },
  { href: '/methodology', label: 'Methodology', key: 'methodology' },
  { href: '/compare', label: 'Compare', key: 'compare' },
];

export function masthead(current: string, coverage?: string): string {
  const nav = NAV.map(
    (n) => `<a href="${n.href}"${n.key === current ? ' aria-current="page"' : ''}>${n.label}</a>`,
  ).join('\n      ');
  return `<header class="masthead">
    <div class="masthead-top">
      <a class="wordmark" href="/">Quota Reset<span>&nbsp;Index</span></a>
      <nav aria-label="Primary">
      ${nav}
      <a href="/ledger.json">JSON</a>
      <a href="/ledger.csv">CSV</a>
      </nav>
    </div>
    <p class="masthead-sub">A sourced, append-only record of discretionary AI quota resets — and two
    forecasts built on it.${coverage ? ` Covers <strong>${coverage}</strong>.` : ''}
    Published by <a href="https://kingy.ai">Kingy AI</a>.</p>
  </header>`;
}

export function page(o: PageOptions): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${NOINDEX ? '<meta name="robots" content="noindex, nofollow">\n' : ''}${o.head ?? `<link rel="canonical" href="${CANONICAL_ORIGIN}${o.path ?? '/'}">`}
<title>${esc(o.title)}</title>
<style>${STYLES}${o.extraStyles ?? ''}</style>

<div class="shell">
${masthead(o.current, o.coverage)}

${o.body}

<footer>
<strong>Corrections welcome against the evidence, not against the conclusions.</strong>
Records are append-only: nothing is edited in place or deleted, and every correction is a new record
that links back to the one it replaces. Data at <a href="/ledger.json">/ledger.json</a> and
<a href="/ledger.csv">/ledger.csv</a>, CORS-open and free to use — see
<a href="/methodology#data">Methodology</a>.
</footer>
</div>
${o.script ? `<script>\n${o.script}\n</script>` : ''}
</html>
`;
}
