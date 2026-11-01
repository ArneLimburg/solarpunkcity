---
name: new-building
description: Add a new building type to Solar Punk City (definition, category, icon, model, balancing). Use when asked to add, create or introduce a building, farm, house, power plant or similar.
---

# Add a new building type

Arguments: the building's name and, optionally, its purpose, category and numbers.

1. Read `src/gameDefinitions.ts` and `src/resources.ts` to see existing buildings and resources.
2. Pick the category from `BuildingCategories`. If none fits, add a new category with
   `buildable: true` and an icon under `public/<category>/`.
3. Add an entry to `BuildingTypes` (`category`, `icon`, `model`). Reuse an existing icon and
   `.glb` model if no new asset was provided — never invent paths to files that do not exist
   in `public/`.
4. Add the matching entry to `BuildingDefinition` with `name`, `type`, `description`, `size`,
   `resident`, `cost`, `produces`, `consumes` and optional `recycling`. Spread
   `...emptyResources` into every `Resources` value.
5. Balance against existing buildings: compare cost per unit of output and labor per unit of
   output with the closest existing building, and state the comparison in your summary.
   Keep the sustainability theme: high output should come with higher labor, cost or
   ecological trade-offs.
6. Check whether `src/game.ts` handles the new production/consumption (e.g. a new resource
   that is never produced or consumed anywhere). Mention gaps instead of silently ignoring them.
7. Run `npm run lint` and `npm run build` and fix any errors.
8. Summarize the new building with its numbers and the balancing comparison.
