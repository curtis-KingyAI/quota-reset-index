#!/bin/zsh
#
# Weekly staleness check for the Quota Reset Index, run by launchd.
#
# ── WHY THIS EXISTS, AND WHAT IT REPLACES ────────────────────────────────────
#
# A cloud routine did this job until 2026-07-27, when it turned out Claude Code on
# the web is disabled by this account's org admin: the routine fired correctly every
# week and wrote its report into a surface NOBODY COULD OPEN. It was write-only, and
# nobody noticed for a day because a report nobody reads looks exactly like a report
# with nothing in it.
#
# So the single design rule here is: OUTPUT MUST LAND SOMEWHERE A HUMAN ACTUALLY
# SEES. That means a macOS notification, not a log file someone would have to
# remember to open — remembering is the thing this is supposed to replace.
#
# ── AND ITS OWN FAILURE MUST BE VISIBLE ─────────────────────────────────────
#
# The second lesson from the same incident: a scheduled job that breaks silently is
# worse than no job, because its silence is indistinguishable from good news. So:
#
#   - a broken run (missing repo, missing node, npm failure) NOTIFIES, it does not
#     just exit non-zero into a log nobody reads
#   - every run appends a timestamped line to a heartbeat log, so "ran and found
#     nothing" can be told apart from "never ran"
#   - `--status` prints the recent history, so liveness is checkable in one command
#
# Usage:
#   weekly-check.sh            what launchd runs
#   weekly-check.sh --test     force a notification, to prove the pipeline works
#   weekly-check.sh --status   show recent runs

set -u

REPO="${QRI_REPO:-$HOME/quota-reset-index}"
LOG_DIR="$HOME/Library/Application Support/QuotaResetIndex"
LOG="$LOG_DIR/weekly-check.log"

mkdir -p "$LOG_DIR"

now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { print -r -- "$(now)  $1" >> "$LOG"; }

notify() {
  local title="$1" message="$2"
  # osascript is the only dependency-free route to a real notification. If it fails
  # the run is still logged, so a broken notifier degrades to the log rather than
  # to silence about the silence.
  /usr/bin/osascript -e "display notification \"${message//\"/\\\"}\" with title \"${title//\"/\\\"}\"" 2>/dev/null \
    || log "WARN  notification failed to post"
}

if [[ "${1:-}" == "--status" ]]; then
  if [[ -f "$LOG" ]]; then
    print -- "last 15 runs — $LOG"
    tail -15 "$LOG"
  else
    print -- "no runs recorded yet ($LOG does not exist)"
    print -- "If launchd is loaded and a Monday has passed, that itself is the finding."
  fi
  exit 0
fi

if [[ "${1:-}" == "--test" ]]; then
  notify "Quota Reset Index" "Test notification — the weekly check can reach you."
  log "TEST  forced notification"
  print -- "sent. If no banner appeared, macOS notifications are blocked for osascript."
  exit 0
fi

# ---- the actual check ----

if [[ ! -d "$REPO" ]]; then
  log "ERROR repo not found at $REPO"
  notify "Quota Reset Index — check BROKEN" "Repo not found at $REPO. The weekly staleness check cannot run."
  exit 1
fi

cd "$REPO" || { log "ERROR cannot cd to $REPO"; exit 1 }

OUTPUT=$(npm run --silent sweep -- --check 2>&1)
STATUS=$?

if [[ $STATUS -eq 0 ]]; then
  # Healthy. Logged but deliberately NOT notified: a weekly "all fine" banner is
  # noise, and noise is what gets muted — after which the overdue one is muted too.
  log "OK    ${OUTPUT//$'\n'/ | }"
elif print -r -- "$OUTPUT" | grep -q "OVERDUE"; then
  log "OVERDUE ${OUTPUT//$'\n'/ | }"
  notify "Quota Reset Index — sweep overdue" "The ledger has not been reviewed in 21+ days. Readers are already seeing a staleness warning. Run: npm run sweep"
else
  # Non-zero for a reason that is NOT overdue — npm missing, node missing, a crash.
  # This is the case the cloud routine got wrong by being unable to report at all.
  log "ERROR exit=$STATUS ${OUTPUT//$'\n'/ | }"
  notify "Quota Reset Index — check BROKEN" "The weekly check failed to run (exit $STATUS). See weekly-check.log."
fi

exit 0
