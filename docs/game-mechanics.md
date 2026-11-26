# Game mechanics

This document explains how _Solar Punk City_ works, step by step. The game runs in weeks: one
week passes every second. Everything below happens once per week unless stated otherwise.

## 1. The board and the starting situation

- The board is a field of hexagonal tiles: a centre tile and 30 rings around it, 2,791 tiles in
  total.
- At the start every tile is covered by forest, except the centre tile, which holds the
  **settlers' camp**, and the **river**.
- The river flows across the whole board from the mountain edge (top) to the sea edge (bottom)
  in a gentle S-curve. It is one tile wide, always the same in every game, and passes the camp a
  few tiles to the east. River tiles cannot be built on or over, so you have to plan around the
  river. Like forest it has an ecology value of +1, so it does not change the ecology at the
  start. It produces and needs nothing.
- The settlement starts with **2 residents**, **0 wood** and **10 food**. It has no wood storage
  yet, so the wood capacity is 0 (see section 2).
- The camp houses the 2 first settlers and feeds them on its own: it produces 2 food per week
  (reduced by the harvest factor, section 5) and needs no labor, so both settlers are free to
  build from the first week on. New residents only move in where there is more housing (see
  section 5), so for growth you need real housing and food buildings.
- The camp can be built over like a forest tile; it gives no wood back. Afterwards its housing
  and food production are gone (no resident moves out).

## 2. Resources

| Resource | What it is                                                                                         | What it is used for                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Wood     | Comes from forests (0.5 wood per forest per week) and from clearing forest. It is kept in a stock. | Used up week by week while a building is under construction (section 4), and sawn into planks by sawmills. |
| Planks   | Come from sawmills (2 planks per sawmill per week). They are kept in a stock.                      | Used up week by week while an apartment building or an agro-industrial farm is under construction.         |
| Food     | Comes from farms. It is kept in a stock, which works as a buffer.                                  | Every resident eats 1 food per week.                                                                       |
| Labor    | Equals the number of residents. Every resident is one worker per week. It is **not** stored.       | Staffing farms, constructing buildings, sawing planks and working in forests (for wood).                   |

**Storage.** Wood and planks need a place to be stored. The capacity for wood is the sum of the
storage of all finished buildings: every wood storage adds 100 wood, without any wood storage the
capacity is 0. The capacity for planks works the same way: every finished sawmill adds 20 planks,
without a sawmill it is 0. The wood and plank stocks never exceed their capacity. Other resources
are not capped yet. The top bar always shows wood as `stock / capacity` (for example `3 / 100`);
with a capacity of 0 the entry is shown in the error style. Planks are shown right after the wood
in the same way (for example `12 / 20`), but only while the plank capacity is above 0.

Unused labor is lost at the end of the week. The labor shown in the status bar is the labor that
was left over after all work of the last week.

## 3. Placing a building

1. Choose a building in the menu. The details panel shows what it costs and what it does.
2. Hover over the map: a ring shows the tiles the building will cover (1, 7 or 19 tiles). The
   ring is red where the building cannot be placed.
3. Click (or tap twice on a touch screen) to place it.

What happens when you place a building:

- No wood or planks are paid when placing, and the stock is not checked. The wood or planks of a
  building under construction are delivered week by week (see section 4).
- Every forest tile under the building is cleared and gives you **3 wood**. For a building that
  is built from wood, this wood goes into the wood supply of the new construction site first, up
  to the wood cost of the building. Only the rest goes into the wood stock and has to fit into
  the storages (see below). A building that is built from planks cannot use wood, so all the
  cleared wood goes into the wood stock: an agro-industrial farm on 19 forest tiles needs room
  for 57 wood.
- A sawmill that is built over gives back **7 wood** per tile like cleared forest. Its plank
  storage is gone at once, and planks above the new capacity are lost.
- The building is not finished yet. It becomes a construction site (see section 4).
- A building that has a wood cost but needs no construction work is paid in full when it is
  placed and is finished at once. A building with neither wood cost nor work (the wood storage)
  is finished at once and costs nothing.

Building is **not possible** if

- part of the building would lie outside the board,
- part of the building would lie on a tile that already holds a building, or a construction site
  (only forest can be cleared; the river cannot be built over), or
- other resources than wood and work that the building costs are missing, or
- the wood in your stock plus the cleared wood that the site does not take (the cleared wood
  minus the wood cost, never less than 0) would be more than the wood capacity (including the
  storage of the building that is placed). The ring is red in this case. A wood storage can
  therefore always be placed on forest as long as its own 100 capacity makes room for the cleared
  wood.

The work and the wood needed for the construction are **not** checked when placing and nothing is
taken from any stock: the residents do the work over the following weeks and the wood arrives
week by week.

## 4. Construction

- A newly placed building is a **construction site**. It needs a certain amount of work, counted
  in worker-weeks: one resident working for one week does one worker-week of work.
- Every building has a **maximum number of builders per week**. More residents than that cannot
  work on the same site at the same time.
- Most buildings are built from wood, the apartment building and the agro-industrial farm are
  built from **planks** (no building needs both). Everything said here about wood holds for the
  planks of these buildings, too; the wood stock is replaced by the plank stock.
- Each construction site has its own **material supply**. It holds at most the wood (or planks)
  the site still needs (the cost minus what has already been used up). The supply of a wood site
  starts with the wood from the cleared forest (section 3); the supply of a plank site starts
  empty.
- Every worker-week needs material: the cost divided by the work of the building. This is the
  **wood per builder-week** (a farm: 25 wood for 24 worker-weeks, about 1.04 wood per
  builder-week) or the **planks per builder-week** (an apartment building: 6 planks for 20
  worker-weeks, 0.3 planks per builder-week). The details panel shows it.
- Each week the available residents are assigned to the construction sites, **oldest site
  first**. A site gets as many builders as the maximum allows, but never more than the work it
  still needs, never more than the residents that are still free, and never more than its
  material allows: the material in its own supply plus the stock, divided by the material per
  builder-week and rounded down. Free residents move on to the next site.
- The material that the builders use comes from the site's own supply first, then from the
  stock. Only the material used this week is taken from the stock; the stock is never moved to
  the sites in advance. In the last week of work the site uses exactly the material it still
  needs, so in total it uses exactly its cost (an apartment building: exactly 6 planks).
- A site that gets no builder only because of missing wood or planks is **waiting for
  material** that week. Sites keep their supply and their progress, also during hunger.
- Wood comes to a site from the cleared forest (when placing) and from forestry (section 5, step
  4); planks come from sawmills (section 5, step 4). The material in site supplies does not
  count to the stocks or to the capacities.
- Work that has been done is never lost. If the population shrinks, the sites simply get fewer
  builders.
- In the week the last work is done, the site becomes the finished building. It starts to
  produce, consume and house residents **from the following week on**.
- While it is a construction site, a building
  - produces nothing and consumes nothing,
  - provides no housing,
  - counts as a tile with ecology 0 (neither good nor bad), and
  - cannot be built over. A construction site cannot be cancelled.
- On the map the tiles of a construction site show **bare brown soil**: no trees, no forest
  floor and no building. When the building is finished, it appears on the map.
- The **More** menu shows how many construction sites there currently are. If sites are waiting
  for wood or planks, their number is shown as well (for example `3 (1 waiting for material)`)
  and the entry and the **More** button are shown in the error style.

Example: an organic homestead needs 4 worker-weeks and takes at most 2 builders. With 2
residents and enough wood it is finished after 2 weeks. A farm needs 24 worker-weeks and takes
at most 6 builders: a single resident would need 24 weeks, 6 residents only 4 weeks.

A farm on 7 forest tiles starts with 21 wood in its supply and needs 4 more. Without any wood
storage it is still built: forestry delivers the missing wood to the site, it just takes longer.

## 5. What happens each week, in order

1. **Food production and staffing.**
   - Farms need workers. Farms that produce more food per worker are staffed first.
   - Only as many workers are assigned as are needed to produce the food that this week's
     residents will eat. Farms that need no workers always produce at full capacity.
   - A farm with only part of its staff produces the same part of its food.
   - The **harvest factor** reduces all harvests when the ecology is low (section 6): at 90 %
     ecology or more the harvest is 100 %, at 50 % or less it is 50 %, in between it falls in a
     straight line.
2. **Eating and hunger.**
   - The food stock plus the food produced this week is available. Every resident eats 1 food.
   - If there is enough food, the rest stays in the stock.
   - If there is not enough food, the whole stock is eaten up and the population shrinks to the
     number of whole portions of food that were available (but never below 1 resident).
     Workers beyond the new population are no longer available this week.
3. **Construction.** The workers that are still free work on the construction sites as
   described in section 4, oldest site first, as far as the wood allows. Sites that are completed
   this week are finished at the end of the week.
4. **Other production.** The workers that are still free do the remaining work, in this order:
   1. **Sawmills** (finished ones only, in the order they were placed). A sawmill works only if
      the wood stock holds at least 4 wood, at least 2 workers are still free, and there is free
      space in the supply of a construction site that is built from planks or in the plank
      storage. It then takes 4 wood from the wood stock (never from a site supply) and 2
      workers and makes 2 planks. The planks go into the supplies of the plank sites first
      (oldest site first, each up to its free space); the rest goes into the plank stock,
      capped so that the stock never exceeds the capacity, and planks beyond that are lost.
      Planks that reach a site this week are used from the next week on. A sawmill never works
      partly.
   2. **Forestry and everything else.** Every forest tile that gets a worker produces 0.5 wood.
      A building that cannot be staffed fully or lacks other inputs does not produce anything.
      The produced wood goes into the wood supplies of the construction sites first (oldest
      site first, each up to its free space); the rest goes into the wood stock, capped so that
      the stock never exceeds the capacity. Wood that reaches a site this week is used from the
      next week on. Forestry only works while there is free space in a wood site supply or in the
      wood storage. Otherwise (for example without a wood storage and without a construction
      site that needs wood) no forest works and its labor stays free.

   Because the sawmills come first, they get the free workers before the forests do.

5. **Population growth.** If everyone could eat, the population grows. The growth is the smallest
   of
   - 10 % of the population, multiplied by the satisfaction (a satisfaction of 50 % halves it)
     and rounded up,
   - the free housing (housing minus population), and
   - the whole portions of food left in the stock after eating.

   New residents start to work in the following week.

## 6. Ecology and satisfaction

- Every tile has an **ecology value**. Forest has the reference value +1. Other buildings have
  their own value per tile they cover (see the table in section 7); a construction site counts as 0.
- The **ecology** of the whole city is the average ecology value of all tiles compared to a board
  that is completely forest. 100 % means every tile is forest; it cannot go below 0 % or above
  100 %.
- The **free labor share** of a week is the labor that is left after all work of that week,
  divided by the population at the start of that week (between 0 % and 100 %). The status bar
  shows it next to the free labor, for example `3 (15 %)`; the entry is shown in the error
  style while the labor factor is below 100 %. Before the first week it is shown as 0 %.
- The **labor factor** (0–100 %) tells how well the labor is used:

  | Free labor share | Labor factor                               |
  | ---------------- | ------------------------------------------ |
  | 0 %              | 50 % (overloaded)                          |
  | 0 % – 10 %       | rises in a straight line to 100 %          |
  | 10 % – 25 %      | 100 % (ideal)                              |
  | 25 % – 75 %      | falls in a straight line from 100 % to 0 % |
  | 75 % and more    | 0 % (mass unemployment)                    |

  Examples: 5 % free labor gives 75 %, 50 % gives 50 %, 75 % gives 0 %.

- **Satisfaction** is the average of the ecology and the labor factor. The residents judge the
  **previous week**: the labor factor is calculated at the end of each week and used for the
  population growth of the next week. At the start of the game there is no previous week, so the
  labor factor is 100 %. The status bar tooltip of the satisfaction shows the breakdown (ecology
  and work).
- Ecology reduces the harvest (section 5, step 1). Satisfaction, and with it ecology and work,
  slows down population growth (section 5, step 5).
- Clearing forest therefore always lowers the ecology, and the more tiles a building covers the
  more it matters. The agro-industrial farm has a strongly negative value on each of its 19
  tiles.

## 7. All buildings

| Building             | Tiles | Material  | Work (worker-weeks)  | Material per builder-week | Builders per week | Produces per week | Consumes per week | Residents | Ecology per tile |
| -------------------- | ----- | --------- | -------------------- | ------------------------- | ----------------- | ----------------- | ----------------- | --------- | ---------------- |
| Organic homestead    | 1     | 4 wood    | 4                    | 1.0                       | 2                 | 3 food            | 2 workers         | 3         | +0.5             |
| Apartment building   | 1     | 6 planks  | 20                   | 0.3                       | 4                 | –                 | –                 | 15        | 0                |
| Farm                 | 7     | 25 wood   | 24                   | 1.0                       | 6                 | 20 food           | 4 workers         | 2         | +0.2             |
| Agro-industrial farm | 19    | 40 planks | 80                   | 0.5                       | 10                | 60 food           | 8 workers         | 0         | −5               |
| Wood storage         | 1     | –         | – (finished at once) | –                         | –                 | –                 | –                 | 0         | 0                |
| Sawmill              | 1     | 15 wood   | 10                   | 1.5                       | 3                 | 2 planks          | 4 wood, 2 workers | 0         | 0                |
| Forest               | 1     | –         | –                    | –                         | –                 | 0.5 wood          | 1 worker          | 0         | +1               |
| Settlers' camp       | 1     | –         | –                    | –                         | –                 | 2 food            | –                 | 2         | 0                |
| River                | 1     | –         | –                    | –                         | –                 | –                 | –                 | 0         | +1               |

The wood or planks of a building are not paid when placing, but used up during construction.
The early game (settlers' camp, homestead, farm) needs wood only; a growing town needs the first
production chain: forest, wood, sawmill, planks, construction site.

The wood storage is free, is finished immediately when placed (no construction site, gravel
ground and a log yard on the map), stores 100 wood and cannot be built over. The sawmill is an
open saw shed with a saw bench, a plank stack and a log pile on bare earth; it stores 20 planks
and gives back 7 wood when it is built over. The forest and the settlers' camp cannot be built. A
cleared forest tile gives 3 wood, the camp gives nothing. The river cannot be built and cannot be
built over.

## 8. Example: the first weeks

- **Start (week 0):** 2 residents in the settlers' camp, 0 wood, 10 food, no wood storage. An
  organic homestead costs 4 wood and 4 worker-weeks, so it needs 1 wood per builder-week. You
  place it on a forest tile next to the camp. Nothing is paid; the 3 wood of the cleared forest
  go into the supply of the construction site, the wood stock stays at 0. The tile shows bare
  soil.
- **Week 1:** The camp produces 2 food and the 2 residents eat 2 food (10 left). The camp needs
  no labor, so both residents work on the homestead (2 of its 4 worker-weeks) and use 2 of the 3
  wood in its supply. Nobody is free for forestry. Housing is 2, so the population cannot grow.
- **Week 2:** Same food balance. The supply holds only 1 wood, so only 1 resident can build (3 of
  4 worker-weeks). The other resident works in a forest and delivers 0.5 wood to the site.
- **Week 3:** The supply holds 0.5 wood, which is not enough for a worker-week: the site is
  waiting for wood (the More menu shows `1 (1 waiting for material)`). Both residents are free for forestry.
  One forest delivers 0.5 wood and fills the supply with the last wood the site needs; the other
  forest has no room for its wood (there is no wood storage) and does not work.
- **Week 4:** One resident finishes the homestead with the last wood. The soil is replaced by
  the homestead, but it does not take part yet.
- **Week 5:** The camp already covers the 2 residents, so the homestead needs no workers.
  Housing is now 2 + 3 = 5, so one more resident can move in: the population grows to 3.
- **Week 6:** There are 3 residents who need 3 food. The camp produces 2, so the homestead is
  staffed with 1 worker (1.5 food). The city is in balance: for further growth it needs more
  housing and more farms. For further buildings, a wood storage keeps the wood from forestry
  that no construction site needs.
- **Later:** An apartment building needs 6 planks, which only a sawmill makes. With a wood
  storage in place, the sawmill is built from 15 wood and 10 worker-weeks. Once it is finished
  it turns 4 wood and 2 workers into 2 planks per week, fills the supply of the apartment site
  first and then its own plank storage (20 planks). The apartment site builds with at most
  floor(available planks / 0.3) workers and waits for material when the planks run out.
