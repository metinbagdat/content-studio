# Agent Handoff Log

Read `../cursor.md` first if you haven't. This file is a short, dated log of
**what the last few agent sessions did and what the next one should know** —
not a full changelog (git history + `docs/ROADMAP.md` cover that).

Keep entries short. Newest on top. When you finish a session that made
non-trivial progress, or hit friction another agent would otherwise
re-discover from scratch, add an entry here before you stop.

---

## 2026-09-14 (later same day) — First test suite (Vitest)

Repo had zero automated tests. Opened [#123](https://github.com/metinbagdat/content-studio/pull/123):
Vitest (`npm test`, root `vitest.config.mts`) + 37 unit tests for pure logic
(`packages/core/src/platforms/{limits,formats}.test.ts`,
`lib/scheduling/postingTimes.test.ts`, `lib/image/platformSizes.test.ts`,
`lib/discovery/articleFingerprint.test.ts`). Extracted
`lib/discovery/articleFingerprint.ts` (`normalizeTitle`/`hashContent`/
`isLikelyHubPage`) out of `duplicateDetection.ts` so it's testable without a
live DB — `duplicateDetection.ts` re-exports the same names, no call sites
changed. **Pattern for future work:** keep DB-touching code in its own file,
separate from pure logic, so it stays unit-testable.

---

## 2026-09-14 — Cloud sandbox drift + dep security fix + Docker-less setup

**Context:** A prior Cursor Cloud session had a long conversation building
features (podcast schema, infographics, review-queue reordering, dark theme,
etc.) but was working off a **stale branch** that predated the `apps/web` /
`apps/worker` / `packages/db` monorepo migration (CS-M1/CS-M2). When asked to
"continue with the logical next step" in a *new* session, that stale
context was almost acted on — but `origin/main` had moved ~500 files / ~49k
lines ahead in the meantime (real production work: YouTube publish, video
pipeline, WordPress bridge, Hostinger Reach, etc.). **Lesson:** don't trust a
conversation summary's idea of "current work" — always re-sync with
`origin/main` and re-check `docs/ROADMAP.md` + `gh issue list` first.

**What shipped this session:**
- [#121](https://github.com/metinbagdat/content-studio/pull/121) (merged) —
  `next` 15.5.22→15.5.25, `sharp` →0.35.4. Fixed 1 critical (Next.js RCE:
  Windows-hosted servers + AVIF Image Optimization) + 1 high (sharp/libheif)
  `npm audit` finding. Verified via `npm run typecheck` + `npm run build`.
  Remaining `npm audit` finding (`prisma`→`@prisma/config`→`deepmerge-ts`,
  stack-exhaustion DoS) has no non-major fix yet; it's CLI/dev-tooling only
  (not shipped to the deployed runtime) — left as-is.
- [#122](https://github.com/metinbagdat/content-studio/pull/122) — Cloud
  sandbox VM has **no Docker, no PostgreSQL preinstalled**. `npm run dev` /
  `npm run worker`'s `predev`/`preworker` hooks shell out to `docker` and
  fail hard here. Fix: install PostgreSQL natively (`apt-get install
  postgresql`), create `content`/`content` role + `content_studio` db on
  `127.0.0.1:5432` (not the docker-compose port 5434 from `.env.example`),
  and run with `SKIP_LOCAL_DOCKER=true` (existing env flag, was previously
  undocumented) to skip the Docker-only predev/preworker checks. Documented
  in `AGENTS.md`. Also flipped `CS-M0`/`CS-M1` from stale `doing` → `done`
  (every scope/done-when box was already checked or freshly verified).
- Added this file + root `cursor.md` so the "stale context" problem above is
  less likely to recur for any agent (cloud or local IDE) working here.

**Open issues checked and found blocked on non-code work** (do not restart
these without a real trigger — see the linked issue for the actual gate):
[#51](https://github.com/metinbagdat/content-studio/issues/51) GSC OAuth
refresh (wait for GSC impressions), [#36](https://github.com/metinbagdat/content-studio/issues/36)
SEO HPV trigger (needs DataForSEO/Soro creds), [#32](https://github.com/metinbagdat/content-studio/issues/32)
Meta App Review (manual developer-console workflow), [#7](https://github.com/metinbagdat/content-studio/issues/7)
Suno/Udio sung audio (paid API), [#108](https://github.com/metinbagdat/content-studio/issues/108)/[#109](https://github.com/metinbagdat/content-studio/issues/109)
Growth epics (cross-repo with `learncon`, need product direction first).

**Next step suggestion (not started):** nothing code-shaped was obviously
unblocked at the time of writing. Ask the maintainer which of the
blocked-on-manual-step items (Meta App Review checklist, GSC impressions,
DataForSEO creds) has since become unblocked, or for a new feature.
