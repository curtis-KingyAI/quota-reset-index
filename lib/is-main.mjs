import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * "Was this module run directly, rather than imported?"
 *
 * The obvious spelling — `process.argv[1] === fileURLToPath(import.meta.url)` —
 * is WRONG on macOS and any other system with symlinked paths. `import.meta.url`
 * is resolved through symlinks; `process.argv[1]` is not. So a repo living under
 * /tmp, /var/folders, or a symlinked home directory compares
 *   /tmp/x/scripts/check-append-only.mjs        (argv)
 * against
 *   /private/tmp/x/scripts/check-append-only.mjs (meta)
 * they differ, main() never runs, and the script exits 0 having done nothing.
 *
 * For the pre-commit hook that failure mode is silent and catastrophic: the
 * append-only gate reports success while checking nothing. Both sides get
 * realpath'd here so that cannot happen.
 */
export function isMain(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
