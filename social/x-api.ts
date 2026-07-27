/**
 * The official X API v2 provider.
 *
 * ── WHY THE OFFICIAL API AND NOT SCRAPING ───────────────────────────────────
 *
 * x.com serves a login wall to unauthenticated clients, so scraping means either
 * borrowing a logged-in session or defeating bot detection. Both breach the terms;
 * the second is not something this project will build at any price. The API is the
 * supported route and it is what both existing trackers use — codexreset.org says
 * so outright: "Every hour, the X API checks public posts and replies from approved
 * accounts."
 *
 * ── COST, WHICH IS A DESIGN CONSTRAINT AND NOT A FOOTNOTE ───────────────────
 *
 * X closed the flat $200/mo Basic tier to new signups in February 2026 and retired
 * the free tier. New developers are pay-per-use, around $0.005 per post read.
 *
 * That makes the polling strategy the difference between a few dollars a month and
 * a few hundred, so it is fixed here rather than left to a caller:
 *
 *   - `since_id` on every call, so a poll returns ONLY posts newer than the last
 *     one seen. A quiet hour reads nothing and costs nothing.
 *   - `max_results` held low. The signal decays with a 10h half-life, so a backlog
 *     of old posts has no value worth paying for.
 *   - The numeric user id is cached after first lookup. It never changes, and a
 *     user read costs twice a post read.
 *
 * `capabilities.metered` is true so a scheduler cannot pretend otherwise.
 *
 * ── THE TOKEN ───────────────────────────────────────────────────────────────
 *
 * Read from the environment, used in one Authorization header, never logged, never
 * printed, never written to the observation log, and never included in an error
 * message. Creating the developer account and supplying the token is the operator's
 * job, not an agent's. Absent a token this provider reports unavailable and the
 * poller does nothing — that is the default state and it costs zero.
 */

import { decodePostId } from '../lib/snowflake.mjs';
import { classify } from './classify.ts';
import { NO_SOCIAL_SIGNAL, type SocialCapabilities, type SocialProvider, type SocialReading } from './provider.ts';

const API = 'https://api.x.com/2';

/** Fetch enough to catch a burst, few enough that a poll is cheap. */
export const MAX_RESULTS = 5;

/** The accounts either model carries a weight for. */
export const TRACKED_HANDLES = Object.freeze({
  /** Model A `tibo`, w=1.45 — the highest weight in either model. */
  codex: 'thsottiaux',
  /** Model B `dev`, w=1.35. */
  claudeCode: 'ClaudeDevs',
});

export interface XApiOptions {
  handle: string;
  token?: string;
  /** Injected so tests never touch the network. */
  fetchImpl?: typeof fetch;
  /** Last post id already seen, for `since_id`. */
  sinceId?: string | null;
  /** Cached numeric user id, to skip a metered user lookup. */
  userId?: string | null;
}

interface XPost {
  id: string;
  text: string;
  created_at?: string;
}

export class XApiProvider implements SocialProvider {
  readonly id = 'x-api-v2';
  readonly handle: string;
  readonly capabilities: SocialCapabilities = {
    postDiscovery: true,
    contentAccess: true,
    supported: true,
    metered: true,
  };

  #token: string | undefined;
  #fetch: typeof fetch;
  #sinceId: string | null;
  #userId: string | null;

  constructor(o: XApiOptions) {
    this.handle = o.handle;
    // Read here and held privately. Never re-exposed on the instance.
    this.#token = o.token ?? process.env.QRI_X_BEARER_TOKEN ?? undefined;
    this.#fetch = o.fetchImpl ?? globalThis.fetch;
    this.#sinceId = o.sinceId ?? null;
    this.#userId = o.userId ?? null;
  }

  describe(): string {
    return (
      `X API v2, @${this.handle}, polled with since_id so a quiet interval costs nothing. ` +
      `Metered (~$0.005 per post read). ${this.#token ? 'Credential present.' : 'NO CREDENTIAL — inert.'}`
    );
  }

  /** Numeric user id, cached. Exposed so a poller can persist it and skip the lookup. */
  get userId(): string | null {
    return this.#userId;
  }

  async #get(path: string): Promise<any> {
    const res = await this.#fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${this.#token}`, 'User-Agent': 'quota-reset-index' },
    });
    if (!res.ok) {
      // Status and path only. A response body can echo request headers, and this
      // string reaches logs.
      throw new Error(`X API ${res.status} on ${path}`);
    }
    return res.json();
  }

  async #resolveUserId(): Promise<string> {
    if (this.#userId) return this.#userId;
    const body = await this.#get(`/users/by/username/${encodeURIComponent(this.handle)}`);
    const id = body?.data?.id;
    if (!id) throw new Error(`X API returned no id for @${this.handle}`);
    this.#userId = String(id);
    return this.#userId;
  }

  async read(now: Date): Promise<SocialReading> {
    if (!this.#token) {
      return NO_SOCIAL_SIGNAL(
        this.handle,
        this.id,
        now,
        'QRI_X_BEARER_TOKEN is not set — no request was made and nothing was spent',
      );
    }

    let posts: XPost[];
    try {
      const userId = await this.#resolveUserId();
      const params = new URLSearchParams({
        max_results: String(MAX_RESULTS),
        'tweet.fields': 'created_at',
        exclude: 'retweets',
      });
      if (this.#sinceId) params.set('since_id', this.#sinceId);
      const body = await this.#get(`/users/${userId}/tweets?${params}`);
      posts = Array.isArray(body?.data) ? body.data : [];
    } catch (e) {
      return NO_SOCIAL_SIGNAL(this.handle, this.id, now, (e as Error).message);
    }

    if (!posts.length) {
      // Nothing new is a real answer, distinct from a failure — but it is NOT
      // "strength 0". The account being quiet since the last poll says nothing
      // about how old the newest post is, which is what the model needs.
      return NO_SOCIAL_SIGNAL(this.handle, this.id, now, 'no posts newer than since_id');
    }

    // Score every new post and keep the strongest. A burst usually contains one
    // post that carries the claim and several that react to it.
    const scored = posts.map((p) => {
      const c = classify(p.text);
      // Prefer the id's own timestamp: a decode is arithmetic, not testimony, and
      // it does not depend on `created_at` being present or correct.
      const decoded = decodePostId(p.id);
      const createdMs = decoded?.getTime() ?? (p.created_at ? Date.parse(p.created_at) : NaN);
      return { post: p, c, createdMs };
    });

    scored.sort((a, b) => b.c.strengthPct - a.c.strengthPct || b.createdMs - a.createdMs);
    const best = scored[0];

    const ageHours = Number.isFinite(best.createdMs) ? (now.getTime() - best.createdMs) / 3_600_000 : null;

    return {
      handle: this.handle,
      strengthPct: best.c.strengthPct,
      ageHours: ageHours === null ? null : Math.round(ageHours * 100) / 100,
      postId: best.post.id,
      observedAt: now.toISOString(),
      provenance: 'official-api',
      providerId: this.id,
      note:
        `${posts.length} new post${posts.length === 1 ? '' : 's'}; ` +
        `strongest matched ${best.c.groups.length ? best.c.groups.join('+') : 'nothing'}`,
      matchedTerms: best.c.matchedTerms,
    };
  }
}
