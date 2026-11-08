# Game mechanics

This document explains how _Solar Punk City_ works, step by step. The game runs in weeks: one
week passes every second. Everything below happens once per week unless stated otherwise.

## 1. The board and the starting situation

- The board is a field of hexagonal tiles: a centre tile and 30 rings around it, 2,791 tiles in
  total.
- At the start every tile is covered by forest, except the centre tile: it holds the
  **settlers' camp**.
- The settlement starts with **2 residents**, **10 wood** and **10 food**.
- The camp houses the 2 first settlers and feeds them on its own: it produces 2 food per week
  (reduced by the harvest factor, section 5) and needs no labor, so both settlers are free to
  build from the first week on. New residents only move in where there is more housing (see
  section 5), so for growth you need real housing and food buildings.
- The camp can be built over like a forest tile; it gives no wood back. Afterwards its housing
  and food production are gone (no resident moves out).

## 2. Resources

| Resource | What it is                                                                                         | What it is used for                                                       |
| -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Wood     | Comes from forests (0.5 wood per forest per week) and from clearing forest. It is kept in a stock. | Paid when you place a building.                                           |
| Food     | Comes from farms. It is kept in a stock, which works as a buffer.                                  | Every resident eats 1 food per week.                                      |
| Labor    | Equals the number of residents. Every resident is one worker per week. It is **not** stored.       | Staffing farms, constructing buildings and working in forests (for wood). |

Unused labor is lost at the end of the week. The labor shown in the status bar is the labor that
was left over after all work of the last week.

## 3. Placing a building

1. Choose a building in the menu. The details panel shows what it costs and what it does.
2. Hover over the map: a ring shows the tiles the building will cover (1, 7 or 19 tiles). The
   ring is red where the building cannot be placed.
3. Click (or tap twice on a touch screen) to place it.

What happens when you place a building:

- The **wood cost** is paid immediately.
- Every forest tile under the building is cleared and gives you **3 wood**. This wood can be used
  to pay for the building itself, so a building may be placed even if the stock alone is not
  enough.
- The building is not finished yet. It becomes a construction site (see section 4).

Building is **not possible** if

- part of the building would lie outside the board,
- part of the building would lie on a tile that already holds a building, or a construction site
  (only forest can be cleared), or
- the wood in your stock plus the wood from the cleared forest is less than the wood cost.

The work needed for the construction is **not** checked when placing and no work is taken from
any stock: the residents do it over the following weeks.

## 4. Construction

- A newly placed building is a **construction site**. It needs a certain amount of work, counted
  in worker-weeks: one resident working for one week does one worker-week of work.
- Every building has a **maximum number of builders per week**. More residents than that cannot
  work on the same site at the same time.
- Each week the available residents are assigned to the construction sites, **oldest site
  first**. A site gets as many builders as the maximum allows, but never more than the work it
  still needs and never more than the residents that are still free. Free residents move on to
  the next site.
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
- The status bar shows how many construction sites there currently are.

Example: an organic homestead needs 4 worker-weeks and takes at most 2 builders. With 2
residents it is finished after 2 weeks. A farm needs 24 worker-weeks and takes at most 6
builders: a single resident would need 24 weeks, 6 residents only 4 weeks.

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
   described in section 4. Sites that are completed this week are finished at the end of the
   week.
4. **Other production.** The workers that are still free do the remaining work, such as
   forestry: every forest tile that gets a worker produces 0.5 wood. A building that cannot be
   staffed fully or lacks other inputs does not produce anything.
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
- **Satisfaction** currently equals the ecology.
- Ecology affects the city in two ways: it reduces the harvest (section 5, step 1) and it slows
  down population growth (section 5, step 5).
- Clearing forest therefore always lowers the ecology, and the more tiles a building covers the
  more it matters. The agro-industrial farm has a strongly negative value on each of its 19
  tiles.

## 7. All buildings

| Building             | Tiles | Wood | Work (worker-weeks) | Builders per week | Produces per week | Consumes per week | Residents | Ecology per tile |
| -------------------- | ----- | ---- | ------------------- | ----------------- | ----------------- | ----------------- | --------- | ---------------- |
| Organic homestead    | 1     | 4    | 4                   | 2                 | 3 food            | 2 workers         | 3         | +0.5             |
| Apartment building   | 1     | 10   | 20                  | 4                 | –                 | –                 | 15        | 0                |
| Farm                 | 7     | 25   | 24                  | 6                 | 20 food           | 4 workers         | 2         | +0.2             |
| Agro-industrial farm | 19    | 65   | 80                  | 10                | 60 food           | 8 workers         | 0         | −5               |
| Forest               | 1     | –    | –                   | –                 | 0.5 wood          | 1 worker          | 0         | +1               |
| Settlers' camp       | 1     | –    | –                   | –                 | 2 food            | –                 | 2         | 0                |

The forest and the settlers' camp cannot be built. A cleared forest tile gives 3 wood, the camp
gives nothing.

## 8. Example: the first weeks

- **Start (week 0):** 2 residents in the settlers' camp, 10 wood, 10 food. You place an organic
  homestead on a forest tile next to the camp. It costs 4 wood, but clearing the forest tile
  gives 3 wood: the stock is now 9 wood. The tile shows bare soil.
- **Week 1:** The camp produces 2 food and the 2 residents eat 2 food (10 left). The camp needs
  no labor, so both residents work on the homestead (2 of its 4 worker-weeks). Nobody is free
  for forestry, so there is no new wood. Housing is 2, so the population cannot grow.
- **Week 2:** Same food balance (10 food left); the residents finish the homestead. The soil is
  replaced by the homestead, but it does not take part yet.
- **Week 3:** The camp already covers the 2 residents, so the homestead needs no workers.
  Housing is now 2 + 3 = 5, so one more resident can move in: the population grows to 3.
- **Week 4:** There are 3 residents who need 3 food. The camp produces 2, so the homestead is
  staffed with 1 worker (1.5 food). The 2 other residents work in forests and produce 1 wood.
  The city is in balance: for further growth it needs more housing and more farms.
