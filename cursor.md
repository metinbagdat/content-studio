# Read this first

This is **Content Studio** (`metinbagdat/content-studio`) — the ops tool that
turns egitim.today blog articles into social content and publishes them.
It is **not** LearnCon (`metinbagdat/learncon`); do not put product/growth
code here.

**Every agent session (Cursor Cloud or local IDE) should, in order:**

1. Read [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) — the current state
   snapshot, what the last session did, what's next, and any environment
   gotchas discovered along the way. This repo moves fast (multiple agents +
   the maintainer push directly to `main` daily), so **do not trust a prior
   chat transcript's summary of "current work" over this file or the actual
   `main` branch** — always `git fetch origin main` and re-check
   `docs/ROADMAP.md` + open GitHub issues before continuing "the next step"
   from an old conversation.
2. Read [`AGENTS.md`](AGENTS.md) for Cursor-Cloud-specific environment setup
   (Docker-less sandbox Postgres, `SKIP_LOCAL_DOCKER=true`, admin key, etc.)
   and general repo conventions.
3. Read [`docs/ROADMAP.md`](docs/ROADMAP.md) for the canonical feature
   tracker (`.github/issue-bodies/*.md` for per-item detail).
4. **Before ending a session that made non-trivial progress or discovered
   something future agents need to know**, update
   `docs/AGENT_HANDOFF.md` with a short dated entry. Keep it terse — it's a
   handoff note, not a changelog (git history is the changelog).
