# Solar Punk City

City-building game focused on sustainability (see README.md for the vision).
Deployed to GitHub Pages at https://arnelimburg.github.io/solarpunkcity/ on every push to `main`.

## Stack

- React 19 + TypeScript (strict) + Vite 7
- Babylon.js 8 for the 3D hex map, BeerCSS for UI
- Prettier + ESLint (`npm run lint`), type check + bundle via `npm run build`
- Vitest for unit tests in `test/` (mirrors `src/`, e.g. `test/resources.test.ts`); tests import
  `test`, `expect`, `vi` explicitly from `vitest`; `npm test` enforces 100 % coverage of
  `src/**/*.ts` (v8, no ignore comments)
- Playwright (`@playwright/test`, Chromium only) for e2e smoke tests in `e2e/`; specs import
  `test`/`expect` from `e2e/fixtures.ts`, which collects V8 coverage; `npm run test:e2e` enforces
  per file 100 % functions and 95 % statements, branches and lines of `src/**/*.tsx`
  (monocart-coverage-reports, report in `coverage/e2e/`)

## Commands

- `npm ci` – install dependencies
- `npm run dev` – dev server (served under `/solarpunkcity/`)
- `npm run lint` – prettier check + eslint (CI runs this)
- `npm run prettier` – format all files
- `npm run build` – `tsc -b` + `vite build` (CI runs this)
- `npx playwright install chromium` – install the test browser (once)
- `npm test` – unit tests once with coverage (`vitest run --coverage`); fails below 100 %
  statements, branches, functions and lines of `src/**/*.ts` (`.tsx` is excluded)
- `npm run test:watch` – unit tests in watch mode
- `npm run test:e2e` – Playwright smoke tests (starts the dev server itself, CI runs this);
  fails if the e2e coverage of `src/**/*.tsx` is below the thresholds

Always run `npm run lint`, `npm run build` and `npm test` before considering a change done.

## Architecture

- `src/resources.ts` – `Resources` type and add/subtract/compare helpers
- `src/gameDefinitions.ts` – building categories, building types (icon + 3D model) and
  `BuildingDefinition` (cost, production, consumption, residents, recycling)
- `src/board.ts` – hex board in axial coordinates (`q`, `r`), radius `GRID_RADIUS`,
  initially filled with forest
- `src/game.ts` – game rules: `canBuild`, `build`, weekly tick `calculateWeek`
  (population growth, food, labor, other production)
- `src/App.tsx` – wires game tick (1 s interval), menu and map
- `src/Map.tsx` – Babylon scene: camera, skybox, hex tiles, picking, placing models
- `src/farms.ts`, `src/apartment.ts`, `src/farmGeometry.ts`, `src/FarmRenderer.ts` – building
  models built from code (layout, geometry, instanced rendering)
- `src/forest.ts`, `src/ForestRenderer.ts` – procedural forest with thin instances
- `src/Menu.tsx` – building selection app bar
- `public/` – icons, skybox; referenced by relative paths

Game state currently lives in module-level variables in `board.ts` and `game.ts`.

## Conventions

- Keep game rules in `game.ts` / `board.ts` free of React and Babylon imports.
- Hex math uses axial coordinates; a tile is on the board iff
  `max(|q|, |r|, |q + r|) <= GRID_RADIUS`.
- The project language is English: code, comments, test names, commit messages, pull request
  descriptions, issues and documentation are all written in English.
- Use `type` imports (`verbatimModuleSyntax` is on).
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Work on a branch and open a pull request against `main`; never push to `main` directly.
- 3D models are built from code; there are no `.glb` files, do not add any.
- Model budget:
  - at most 1,000 triangles per footprint tile (size 1: 1,000, size 7: 7,000, size 19: 19,000)
  - geometry is created once per building type and reused for every placement (instances or
    thin instances)
  - at most 3 draw calls per building type (e.g. opaque, transparent, one special material)

## Agent workflow

Tickets become pull requests without manual steps; the repository owner reviews at the end.

1. `/grill-ticket` (local) specifies a ticket and creates the issue with label `ready`.
2. `.github/workflows/implement.yaml` (Sonnet) implements it on `agent/issue-<n>` and opens a
   pull request labeled `agent-pr`.
3. After each Build, `.github/workflows/agent-review.yaml` (Opus) reviews it. `review:changes`
   sends it back to step 2 (at most 3 times), `review:approved` or `review:max-rounds` requests
   a review from the owner. `agent-blocked` means an agent gave up and a human must take over.
4. A "changes requested" review by the owner on an agent pull request starts `implement.yaml`
   again: it addresses that review (which wins over agent reviews), pushes and requests the
   owner's review again. The label `review:owner` keeps the Opus review out from then on; this
   does not count as a review round.
   In both cases a branch that is behind `main` is first rebased onto it by the agent, which
   also resolves conflicts; the workflow then force-pushes with lease. A ruleset allows force
   pushes only on `agent/**` branches (admins bypass it).
5. Merging into `main` requires the commit status `agent-review` (ruleset). For `agent-pr` pull
   requests it is set by Agent Review (success on approval) or by an approving review of the owner
   (`.github/workflows/agent-review-gate.yaml`); every new commit resets it to pending. All other
   pull requests pass immediately.

Agents run as the GitHub App from `AGENT_APP_ID` / `AGENT_APP_PRIVATE_KEY` so their pushes,
pull requests and labels trigger the next workflow. They must not change files in `.github/` or
`.claude/`, and not `CLAUDE.md` while fixing an open pull request (claude-code-action resets these
files to `main` there); `implement.yaml` rejects such commits.
