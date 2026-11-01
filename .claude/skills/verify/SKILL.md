---
name: verify
description: Check that the current changes of Solar Punk City pass CI (prettier, eslint, type check, build) and review them against the project conventions. Use before committing, before opening a pull request, or when asked to verify or check changes.
---

# Verify changes

1. If `node_modules` is missing, run `npm ci`.
2. Run `npm run lint`. On prettier failures run `npm run prettier`, then re-run lint.
   Fix ESLint errors in the code; do not disable rules to make them pass.
3. Run `npm run build` and fix TypeScript or bundling errors.
4. Review `git diff` (and `git diff --staged`) against `CLAUDE.md`:
   - game rules in `game.ts` / `board.ts` stay free of React and Babylon imports
   - board bounds use `max(|q|, |r|, |q + r|) <= GRID_RADIUS`
   - no side effects inside React state updater functions
   - no references to files missing from `public/`
   - no new large binary assets
5. Report what passed, what you fixed, and anything left that needs a human decision.
