# Solar Punk City

City-building game focused on sustainability (see README.md for the vision).
Deployed to GitHub Pages at https://arnelimburg.github.io/solarpunkcity/ on every push to `main`.

## Stack

- React 19 + TypeScript (strict) + Vite 7
- Babylon.js 8 for the 3D hex map, BeerCSS for UI
- Prettier + ESLint (`npm run lint`), type check + bundle via `npm run build`
- No test framework yet

## Commands

- `npm ci` – install dependencies
- `npm run dev` – dev server (served under `/solarpunkcity/`)
- `npm run lint` – prettier check + eslint (CI runs this)
- `npm run prettier` – format all files
- `npm run build` – `tsc -b` + `vite build` (CI runs this)

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
- Use `type` imports (`verbatimModuleSyntax` is on).
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Work on a branch and open a pull request against `main`; never push to `main` directly.
- 3D models are large; do not add new `.glb` files without asking.
