# Solar Punk City

City-building game focused on sustainability (see README.md for the vision).
Deployed to GitHub Pages at https://arnelimburg.github.io/solarpunkcity/ on every push to `main`.

## Stack

- React 19 + TypeScript (strict) + Vite 7
- Babylon.js 8 for the 3D hex map, BeerCSS for UI
- Prettier + ESLint (`npm run lint`), type check + bundle via `npm run build`
- Playwright (`@playwright/test`, Chromium only) for e2e smoke tests in `e2e/`

## Commands

- `npm ci` – install dependencies
- `npm run dev` – dev server (served under `/solarpunkcity/`)
- `npm run lint` – prettier check + eslint (CI runs this)
- `npm run prettier` – format all files
- `npm run build` – `tsc -b` + `vite build` (CI runs this)
- `npx playwright install chromium` – install the test browser (once)
- `npm run test:e2e` – Playwright smoke tests (starts the dev server itself, CI runs this)

Always run `npm run lint` and `npm run build` before considering a change done.

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
- `src/ModelLoader.ts` – glTF loading with an `AssetContainer` cache
- `src/Menu.tsx` – building selection app bar
- `public/` – icons, `.glb` models, skybox; referenced by relative paths

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
- 3D models are large; do not add new `.glb` files without asking.

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

Agents run as the GitHub App from `AGENT_APP_ID` / `AGENT_APP_PRIVATE_KEY` so their pushes,
pull requests and labels trigger the next workflow. They must not change files in `.github/`.
