# Calibration — the first measurement

**Run 2026-07-27. `npm run backtest` reproduces every figure here.**

The forecast has carried a banner since it was built: *the weights are hand-set priors that have never
been checked against an outcome, and the banner comes off when a Brier score replaces it.* Nobody had
ever computed one. This is that number.

**Two findings. Neither flatters the site, and the second is actionable.**

1. **No configuration is distinguishable from simply predicting the historical base rate.** The banner
   stays.
2. **The regime the site publishes — `launch` — is the wrong one.** It over-forecasts by ~14 points and
   scores below a constant rate on non-overlapping windows. `normal` is nearly perfectly calibrated.

---

## Method

For each day, using **only records with `effective_at` strictly before that instant**, compute the
model's P(≥1 Codex reset in the next 48h), then score it against what actually happened. 19 reset
events, 2026-04-01 → 2026-07-21.

**Nothing is fitted.** The model is scored exactly as published. This matters more than usual: the
priors were hand-set by a human reading this same event record, so an in-sample score would measure how
well someone remembered July. A test asserts that appending future events cannot change the state at an
earlier decision point — silent leakage would make the whole result flattering and meaningless.

**The baselines are walk-forward too**, from the same restricted history. A constant rate computed over
the whole span would know the future, and beating a handicapped reference proves nothing.

- `baseline-constant` — a Poisson process at the rate observed so far.
- `baseline-climatology` — the observed frequency of positive windows so far. This is the reference to
  beat: it is what "just predict the historical rate" means.

## Result

**89 scored days · 23 positive windows (25.8%)**

| rank | series | Brier ↓ | skill vs climatology | mean forecast | observed |
|---|---|---|---|---|---|
| 1 | **normal** | **0.1744** | **+0.134** | 25.4% | 25.8% |
| 2 | quiet | 0.1870 | +0.071 | 15.8% | 25.8% |
| 3 | **launch** *(published)* | 0.1895 | +0.059 | **38.9%** | 25.8% |
| 4 | baseline-constant | 0.1953 | +0.030 | 16.5% | 25.8% |
| 5 | baseline-climatology | 0.2013 | — | 16.3% | 25.8% |

Robustness check on **non-overlapping** 48h windows (45 days, 11 positives) — same ordering, and
`launch` drops *below* the constant-rate baseline:

| series | Brier ↓ | skill | mean forecast | observed |
|---|---|---|---|---|
| **normal** | **0.1714** | **+0.156** | 25.9% | 24.4% |
| quiet | 0.1799 | +0.114 | 16.2% | 24.4% |
| baseline-constant | 0.1872 | +0.078 | 16.6% | 24.4% |
| **launch** | 0.1918 | +0.056 | **39.4%** | 24.4% |

## Finding 1 — the banner stays

95% block-bootstrap intervals on the skill score:

| regime | overlapping | non-overlapping |
|---|---|---|
| normal | +0.134 · **[−0.108, +0.265]** | +0.156 · **[−0.136, +0.237]** |
| launch *(published)* | +0.059 · **[−0.485, +0.302]** | +0.056 · **[−0.519, +0.218]** |

**Every interval includes zero.** Not one configuration is statistically distinguishable from
predicting the historical base rate. The honest reading is that 19 events cannot establish skill,
which is a statement about the sample rather than about the model.

Blocks, not individual days: overlapping 48h windows make consecutive predictions correlated, and
resampling days independently would pretend the sample is larger than it is and produce a falsely tight
interval. The bootstrap is seeded, so the published figure is reproducible.

**So the §7.3 banner remains — but it can now say something stronger and truer than before.** It moves
from *"never checked against an outcome"* to *"checked, and not yet distinguishable from a constant
rate"*. That is a real improvement in honesty, achieved by measuring rather than by waiting.

## Finding 2 — the published regime is the wrong one

This is the actionable half, and it settles a question that was previously an unresolved editorial
judgement.

The site shows the `launch` figure on every page. The backtest says:

- **`launch` over-forecasts by ~13–15 points.** It predicts 38.9% where 25.8% of windows contained an
  event.
- **It ranks below the constant-rate baseline** on non-overlapping windows — worse than assuming
  nothing.
- **`normal` is nearly perfectly calibrated in the large**: 25.4% predicted against 25.8% observed, and
  25.9% against 24.4% on the robustness check. It ranks first under both schemes.

⚠️ **This is a regime-selection finding, not a licence to refit.** Nothing in the model was tuned; three
published configurations were scored and one fits the record. Choosing `normal` remains an editorial
claim about what environment the vendors are in — the evidence now says the record does not look like a
launch window, on average, across April–July 2026.

⚠️ **And the model is not thereby validated.** `normal` also fails to beat the baseline significantly.
Being well-calibrated *in the large* is a weak property: a constant 25.8% would achieve it too. The
Hawkes structure — excitation, refractory dip, mirroring — remains unevidenced.

## What would change these numbers

- **More events.** The binding constraint. At ~1 Codex reset a week, an interval that excludes zero is
  plausibly months away, not the year that "40 events per vendor" implied.
- **Claude Code cannot be assessed at all.** 4 reset events. Nothing here says anything about it, and
  that asymmetry is structural.
- **Any change to the model, weights or regime.** Re-run and re-publish; do not carry these figures
  forward. A test pins the headline finding so a corpus that has grown enough to change the answer
  fails loudly instead of leaving a stale claim on the page.
