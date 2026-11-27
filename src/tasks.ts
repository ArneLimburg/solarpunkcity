import type { HexCoordinates } from "./board";

// Work that the weekly simulation staffed: `workers` places at a workplace
// (key: center of the placed building, tiles: its footprint).
export type WorkSlot = {
  key: string;
  tiles: HexCoordinates[];
  workers: number;
};

// Chooses the task of every resident (workplace key by resident ID). A
// resident keeps the previous task as long as that workplace still has a free
// place; the other places go to the residents without a task, in the order of
// `residentIds`. At most as many residents work as the slots have places.
export function assignTasks(
  previous: Map<number, string>,
  residentIds: number[],
  slots: WorkSlot[],
): Map<number, string> {
  const free = new Map(slots.map(({ key, workers }) => [key, workers]));
  const tasks = new Map<number, string>();
  for (const id of residentIds) {
    const key = previous.get(id);
    if (key !== undefined && (free.get(key) ?? 0) > 0) {
      free.set(key, free.get(key)! - 1);
      tasks.set(id, key);
    }
  }
  const open = residentIds.filter((id) => !tasks.has(id));
  for (const [key, places] of free) {
    for (let i = 0; i < places && open.length > 0; i++) {
      tasks.set(open.shift()!, key);
    }
  }
  return tasks;
}
