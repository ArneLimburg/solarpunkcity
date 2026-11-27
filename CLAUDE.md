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
  (monocart-coverage-reports, report in `coverage/e2e/`); CI runs twelve shards in parallel
  (`E2E_COVERAGE_SHARD=1`: raw coverage only, blob reporter) and the `build` job merges them

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
- `npm run test:e2e:merge [dir]` – merges the raw e2e coverage of the shards (one subdirectory each
  in `coverage/e2e-raw` by default) into `coverage/e2e` and checks the same thresholds

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
- `src/Map.tsx` – React component that wires the map modules below together and places models
- `src/hexGeometry.ts` – `HEX_SIZE`, `hexToPixel`, `pixelToHex`, `tileKey`, hex corner polygon
- `src/TileRenderer.ts` – ground materials, hex tiles as thin instances (one base mesh per ground
  material), invisible pick plane
- `src/SelectionRing.ts` – selection ring and pointer handler (hover, tap, touch rules)
- `src/sceneSetup.ts` – engine, scene, camera, light, skybox, background ground, render loop
- `src/devHooks.ts` – builds the DEV-only `window.__solarpunk` object used by e2e tests
- `src/farms.ts`, `src/apartment.ts`, `src/farmGeometry.ts`, `src/FarmRenderer.ts` – building
  models built from code (layout, geometry, instanced rendering)
- `src/sawmill.ts` – layout of the sawmill model (pure parts, rendered by `FarmRenderer.ts`)
- `src/woodStorage.ts`, `src/WoodStorageRenderer.ts` – log yard model of the wood storage (pure
  log layout and geometry, instanced rendering)
- `src/forest.ts`, `src/ForestRenderer.ts` – procedural forest with thin instances
- `src/forestFloor.ts` – pure pixel generator of the forest floor texture
- `src/settlers.ts`, `src/SettlerRenderer.ts` – residents (roster with stable IDs and colors),
  walkability (`isWalkable`: forest tiles only), loops and movement of the settlers (pure), and
  their pawns as two thin-instance meshes (benchmark: `e2e/settlerBenchmark.spec.ts`)
- `src/SettlerProfile.tsx` – card of the selected settler (name, age, activity); selection by
  resident ID lives in `App.tsx`, hit testing (`pick`) and the marker in `SettlerRenderer.ts`
  (only on taps outside build mode; the figures stay out of ground picking)
- `src/Menu.tsx` – building selection app bar
- `public/` – icons, skybox; referenced by relative paths

Game state currently lives in module-level variables in `board.ts` and `game.ts`.

## Conventions

- File names must not differ only in casing (enforced by ESLint).
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
   A comment on the pull request announces each run that addresses a review (agent or owner,
   step 4) as soon as it starts.
   An implementation agent that stops without a commit and without a reason is started once more
   (label `agent-retry`) before it gets `agent-blocked`.
4. A "changes requested" review by the owner on an agent pull request starts `implement.yaml`
   again: it addresses that review (which wins over agent reviews) and pushes. The label
   `review:owner` keeps the Opus review out from then on; Agent Review requests the owner's
   review once the build passes. This does not count as a review round.
   In both cases a branch that is behind `main` is first rebased onto it by the agent, which
   also resolves conflicts; the workflow then force-pushes with lease. A ruleset allows force
   pushes only on `agent/**` branches (admins bypass it).
5. GitHub runs no `pull_request` or `pull_request_review` workflows while a pull request has
   merge conflicts, so `.github/workflows/agent-sync.yaml` starts `implement.yaml` itself (input
   `pr`) after every push to `main` and every 30 minutes: for an open "changes requested" review
   of the owner on the current commit, for `review:changes` on a conflicting pull request, and
   for every agent pull request behind `main`. A rebase without conflicts is done by a script and
   keeps the `agent-review` approval; conflicts are resolved by the agent. A comment on the pull
   request announces the rebase as soon as it starts. After that, an approved pull request gets
   `review:rebase` and is reviewed again by Opus (not a new round), and one under owner review
   goes back to the owner once the build passes. A failed build of a pull
   request labeled `review:owner`, `review:rebase` or `review:approved` is sent back to
   `implement.yaml` without counting a round; after 3 failed builds in a row it gets
   `agent-blocked`. To start it by hand:
   `gh workflow run implement.yaml -f pr=<n>` (add `-f review=<id>` for an owner review).
6. Merging into `main` requires the commit status `agent-review` (ruleset). For `agent-pr` pull
   requests it is set by Agent Review (success on approval) or by an approving review of the owner
   (`.github/workflows/agent-review-gate.yaml`); every new commit resets it to pending, except a
   rebase without conflicts. All other pull requests pass immediately.

Agents run as the GitHub App from `AGENT_APP_ID` / `AGENT_APP_PRIVATE_KEY` so their pushes,
pull requests and labels trigger the next workflow. They must not change files in `.github/` or
`.claude/`, and not `CLAUDE.md` while fixing an open pull request (claude-code-action resets these
files to `main` there); `implement.yaml` rejects such commits. `claude-code-action` is pinned to
a commit in the agent workflows, and `implement.yaml` sets `restrict_untrusted_prs: "false"`,
because the action cannot confirm the App's write access and would otherwise deny lint, build
and tests on pull request events.
