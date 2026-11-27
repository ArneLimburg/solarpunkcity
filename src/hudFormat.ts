import type { GameState, Workforce } from "./game";
import { stockResources } from "./resourceIcons";
import type { Resources } from "./resources";

export function formatPopulation(state: GameState): string {
  return `${Math.floor(state.population)} / ${Math.floor(state.housing)}`;
}

export function formatFood(state: GameState): string {
  const sign = state.foodBalance < 0 ? "−" : "+";
  return `${Math.floor(state.resources.food)} / ${Math.floor(
    state.capacity.food,
  )} (${sign}${Math.floor(Math.abs(state.foodBalance))}/wk)`;
}

export function formatWood(state: GameState): string {
  return `${Math.floor(state.resources.wood)} / ${Math.floor(
    state.capacity.wood,
  )}`;
}

export function formatPlanks(state: GameState): string {
  return `${Math.floor(state.resources.planks)} / ${Math.floor(
    state.capacity.planks,
  )}`;
}

export function formatWorkersButton(state: GameState): string {
  return `Workers: ${Math.floor(state.resources.labor)} free`;
}

export function formatFreeRow(state: GameState, workforce: Workforce): string {
  return `${workforce.free} (${Math.floor(state.freeLaborShare)} %)`;
}

export function formatPercent(value: number): string {
  return `${Math.floor(value)} %`;
}

export function formatSatisfactionDetail(state: GameState): string {
  return `ecology ${formatPercent(state.ecology)}, work ${formatPercent(
    state.laborFactor,
  )}`;
}

export function formatConstructionSites(state: GameState): string {
  return state.sitesWaitingForWood > 0
    ? `${state.constructionSites} (${state.sitesWaitingForWood} waiting for material)`
    : `${state.constructionSites}`;
}

// stocks of the More dropdown: everything but wood and planks (which have
// their own entries in the top HUD) that is above 0
export function getFurtherStocks(
  resources: Resources,
): (typeof stockResources)[number][] {
  return stockResources.filter(
    (name) => name !== "wood" && name !== "planks" && resources[name] > 0,
  );
}
