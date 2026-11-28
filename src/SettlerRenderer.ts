import {
  Color3,
  Matrix,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type LinesMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import { getVisitorSpots } from "./communityGarden";
import { HEX_SIZE, TILE_TOP } from "./hexGeometry";
import {
  advanceWalker,
  clearTask,
  createWalker,
  endVisit,
  getActivity,
  getStandingTile,
  isRouteBlocked,
  planRoute,
  replanRoute,
  startTask,
  startVisit,
  tileX,
  tileZ,
  updateWalkers,
  type Activity,
  type Resident,
  type Walker,
} from "./settlers";
import { assignTasks, type WorkSlot } from "./tasks";
import { SPOT_HEADINGS, assignVisits, getGardens, type Visit } from "./visits";

const BODY_HEIGHT = 0.2;
const HEAD_DIAMETER = 0.09;
const HEAD_FORWARD = 0.02; // the head sits a bit in front: shows the heading
const HEAD_HEIGHT = BODY_HEIGHT + HEAD_DIAMETER / 2 - 0.01;
const MAX_FRAME_SECONDS = 0.25; // a long pause (hidden tab) must not teleport anyone
const MIN_CAPACITY = 16;
const MARKER_SIZE = 0.1;
// route searches per frame: many new destinations at once are spread out
export const ROUTES_PER_FRAME = 8;
const ROUTE_HEIGHT = TILE_TOP + 0.02;

export type SettlerInfo = {
  id: number;
  x: number;
  z: number;
  tile: HexCoordinates;
  heading: number;
  phase: number;
  walking: boolean;
  pausing: boolean;
};

export type SettlerRenderer = {
  // shows exactly the given residents (keeps the figures of known IDs)
  sync: (residents: Resident[]) => void;
  // the buildings changed: affected figures pick another way
  boardChanged: () => void;
  getSettlers: () => SettlerInfo[];
  // the ID of the frontmost figure at the screen position, if any; hit testing
  // only happens here, on demand
  pick: (x: number, y: number) => number | undefined;
  // marks the resident (undefined: nobody); the marker follows the figure and
  // disappears when the resident is gone
  select: (id: number | undefined) => void;
  getMarker: () => { id: number | undefined; visible: boolean };
  // what the resident does now, undefined for an unknown ID
  getActivity: (id: number) => Activity | undefined;
  // The settlers take the places that the weekly simulation staffed (those
  // with an unchanged workplace keep walking), the others have no task.
  assignWork: (slots: WorkSlot[]) => void;
  // the line along the remaining route of the selected settler
  getRoute: () => { visible: boolean; tiles: HexCoordinates[] };
  // triangles of one figure
  getTriangleCount: () => number;
  // base meshes (one draw call each)
  getMeshCount: () => number;
};

type Part = {
  mesh: Mesh;
  matrices: Float32Array; // 16 floats per figure, rewritten every frame
  colors: Float32Array; // 4 floats per figure
};

function createPart(mesh: Mesh, scene: Scene): Part {
  const material = new StandardMaterial(`${mesh.name}Material`, scene);
  // the colors come from the instances
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  mesh.material = material;
  mesh.isPickable = false;
  // the base mesh bounds do not follow the instances: never cull the figures
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.setEnabled(false);
  return {
    mesh,
    matrices: new Float32Array(0),
    colors: new Float32Array(0),
  };
}

function writeColor(colors: Float32Array, index: number, color: string) {
  const value = parseInt(color.slice(1), 16);
  colors[index * 4] = ((value >> 16) & 255) / 255;
  colors[index * 4 + 1] = ((value >> 8) & 255) / 255;
  colors[index * 4 + 2] = (value & 255) / 255;
  colors[index * 4 + 3] = 1;
}

// translation and rotation around y (row-major like Babylon's matrices)
function writeMatrix(
  matrices: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  sin: number,
  cos: number,
) {
  const o = index * 16;
  matrices[o] = cos;
  matrices[o + 2] = -sin;
  matrices[o + 5] = 1;
  matrices[o + 8] = sin;
  matrices[o + 10] = cos;
  matrices[o + 12] = x;
  matrices[o + 13] = y;
  matrices[o + 14] = z;
  matrices[o + 15] = 1;
}

// Draws every settler as a pawn (an ellipsoid body and a round head) with two
// base meshes that use thin instances: two draw calls for any population.
export function createSettlerRenderer(
  scene: Scene,
  seed: number,
): SettlerRenderer {
  const body = createPart(
    MeshBuilder.CreateSphere(
      "settlerBody",
      { segments: 3, diameterX: 0.12, diameterY: BODY_HEIGHT, diameterZ: 0.12 },
      scene,
    ),
    scene,
  );
  const head = createPart(
    MeshBuilder.CreateSphere(
      "settlerHead",
      { segments: 2, diameter: HEAD_DIAMETER },
      scene,
    ),
    scene,
  );
  const parts = [body, head];
  // thin instances are picked on demand only (the meshes are not pickable)
  for (const part of parts) {
    part.mesh.thinInstanceEnablePicking = true;
  }

  // a cone above the head of the selected settler: one draw call
  const marker = MeshBuilder.CreateCylinder(
    "selectionMarker",
    { diameterTop: MARKER_SIZE, diameterBottom: 0, height: MARKER_SIZE },
    scene,
  );
  const markerMaterial = new StandardMaterial("selectionMarkerMaterial", scene);
  markerMaterial.diffuseColor = Color3.Black();
  markerMaterial.emissiveColor = new Color3(1, 0.85, 0.1);
  markerMaterial.specularColor = Color3.Black();
  marker.material = markerMaterial;
  marker.isPickable = false;
  marker.setEnabled(false);

  let walkers: Walker[] = [];
  let capacity = 0;
  let selectedId: number | undefined;
  let tasks = new Map<number, string>();
  let routeQueue: Walker[] = [];
  // the reserved garden spots by resident ID
  let visits = new Map<number, Visit>();

  // the route line of the selected settler: a thin line mesh that is built
  // again when the remaining route changes (a step, a new route)
  let routeLine: LinesMesh | undefined;
  let linePath: HexCoordinates[] | undefined;
  let lineStep = -1;
  const updateRouteLine = () => {
    const walker = walkers.find(({ id }) => id === selectedId);
    const path = walker?.path;
    const step = walker?.step ?? -1;
    if (path === linePath && step === lineStep) {
      return;
    }
    routeLine?.dispose();
    routeLine = undefined;
    linePath = path;
    lineStep = step;
    const tiles = path?.slice(Math.max(step, 0)) ?? [];
    if (tiles.length >= 2) {
      routeLine = MeshBuilder.CreateLines(
        "settlerRoute",
        {
          points: tiles.map(
            (tile) => new Vector3(tileX(tile), ROUTE_HEIGHT, tileZ(tile)),
          ),
        },
        scene,
      );
      routeLine.color = new Color3(1, 0.85, 0.1);
      routeLine.alpha = 0.6;
      routeLine.isPickable = false;
    }
  };

  const moveMarker = () => {
    const walker = walkers.find(({ id }) => id === selectedId);
    marker.setEnabled(walker !== undefined);
    if (walker) {
      marker.position.set(
        walker.x,
        TILE_TOP + walker.bob + HEAD_HEIGHT + MARKER_SIZE,
        walker.z,
      );
    }
  };

  const write = () => {
    for (let i = 0; i < walkers.length; i++) {
      const walker = walkers[i];
      const sin = Math.sin(walker.heading);
      const cos = Math.cos(walker.heading);
      const y = TILE_TOP + walker.bob;
      writeMatrix(
        body.matrices,
        i,
        walker.x,
        y + BODY_HEIGHT / 2,
        walker.z,
        sin,
        cos,
      );
      writeMatrix(
        head.matrices,
        i,
        walker.x + sin * HEAD_FORWARD,
        y + HEAD_HEIGHT,
        walker.z + cos * HEAD_FORWARD,
        sin,
        cos,
      );
    }
    if (walkers.length > 0) {
      for (const part of parts) {
        part.mesh.thinInstanceBufferUpdated("matrix");
      }
    }
    if (selectedId !== undefined) {
      moveMarker();
      updateRouteLine();
    }
  };

  // searches the routes of the next few settlers that wait for one
  const planRoutes = () => {
    for (const walker of routeQueue.splice(0, ROUTES_PER_FRAME)) {
      if (walker.needsRoute) {
        planRoute(walker);
        if (walker.visit && walker.blocked) {
          stopVisit(walker, false); // no way to the garden: the spot is free
        }
      }
    }
  };

  // frees the spot of the walker and sends it back to a loop
  const stopVisit = (walker: Walker, rest: boolean) => {
    visits.delete(walker.id);
    endVisit(walker, rest);
    updateWalkers([walker]);
  };

  const requestRoute = (walker: Walker) => {
    replanRoute(walker);
    routeQueue.push(walker);
  };

  // The idle gardeners get a spot of a finished garden; visits that are no
  // longer valid (a task, a missing garden) end here, the others go on.
  const assignGardenVisits = () => {
    const gardens = getGardens();
    visits = assignVisits(
      visits,
      walkers.map((walker) => ({
        id: walker.id,
        gardener: walker.hobby === "Gardening",
        hasTask: tasks.has(walker.id),
        ready: walker.cooldown <= 0,
        tile: getStandingTile(walker),
      })),
      gardens,
    );
    for (const walker of walkers) {
      const visit = visits.get(walker.id);
      // no spot (a task already ended the visit of the walker), or an
      // unchanged visit that keeps walking or tending
      if (visit === undefined || visit.garden === walker.visit?.garden) {
        continue;
      }
      const garden = gardens.find(({ key }) => key === visit.garden)!;
      const spot = getVisitorSpots(HEX_SIZE)[visit.spot];
      startVisit(
        walker,
        {
          garden: garden.key,
          x: tileX(garden.center) + spot.x,
          z: tileZ(garden.center) + spot.z,
          heading: SPOT_HEADINGS[visit.spot],
        },
        garden.tiles,
      );
      routeQueue.push(walker);
    }
  };

  scene.onBeforeRenderObservable.add(() => {
    const seconds = Math.min(
      scene.getEngine().getDeltaTime() / 1000,
      MAX_FRAME_SECONDS,
    );
    planRoutes();
    for (let i = 0; i < walkers.length; i++) {
      const walker = walkers[i];
      advanceWalker(walker, seconds);
      if (
        walker.visit &&
        walker.visitStage === "tending" &&
        walker.visitLeft <= 0
      ) {
        stopVisit(walker, true);
      }
    }
    write();
  });

  return {
    sync: (residents) => {
      if (
        residents.length === walkers.length &&
        walkers.every((walker, i) => walker.id === residents[i].id)
      ) {
        return;
      }
      const known = new Map(walkers.map((walker) => [walker.id, walker]));
      walkers = residents.map(
        (resident) =>
          known.get(resident.id) ??
          createWalker(
            resident.id,
            seed ^ Math.imul(resident.id, 0x9e3779b1),
            resident.hobby,
          ),
      );
      if (walkers.length > capacity) {
        capacity = Math.max(walkers.length, capacity * 2, MIN_CAPACITY);
        for (const part of parts) {
          part.matrices = new Float32Array(capacity * 16);
          part.colors = new Float32Array(capacity * 4);
        }
      }
      const present = new Set(walkers);
      routeQueue = routeQueue.filter((walker) => present.has(walker));
      const ids = new Set(walkers.map(({ id }) => id));
      visits = new Map([...visits].filter(([id]) => ids.has(id)));
      residents.forEach((resident, i) => {
        writeColor(body.colors, i, resident.clothing);
        writeColor(head.colors, i, resident.skin);
      });
      for (const part of parts) {
        part.mesh.setEnabled(walkers.length > 0);
        if (walkers.length > 0) {
          part.mesh.thinInstanceSetBuffer("matrix", part.matrices, 16, false);
          part.mesh.thinInstanceSetBuffer("color", part.colors, 4, false);
          part.mesh.thinInstanceCount = walkers.length;
        }
      }
      write();
    },
    boardChanged: () => {
      for (const walker of walkers) {
        // a blocked route is searched again from where the settler stands, and
        // so is the wait without any route
        if (
          walker.blocked ||
          (walker.path.length > 0 && isRouteBlocked(walker))
        ) {
          requestRoute(walker);
        }
      }
      // a demolished or replaced garden frees its spots at once
      const gardens = new Set(getGardens().map(({ key }) => key));
      for (const walker of walkers) {
        if (walker.visit && !gardens.has(walker.visit.garden)) {
          stopVisit(walker, false);
        }
      }
      updateWalkers(walkers);
      write();
    },
    assignWork: (slots) => {
      tasks = assignTasks(
        tasks,
        walkers.map(({ id }) => id),
        slots,
      );
      const tiles = new Map(slots.map(({ key, tiles }) => [key, tiles]));
      for (const walker of walkers) {
        const task = tasks.get(walker.id);
        if (task === walker.task) {
          continue;
        }
        if (task === undefined) {
          clearTask(walker);
        } else {
          startTask(walker, task, tiles.get(task)!);
          routeQueue.push(walker);
        }
      }
      assignGardenVisits();
      updateWalkers(walkers); // the settlers without a task go back to a loop
      write();
    },
    getRoute: () => {
      const walker = walkers.find(({ id }) => id === selectedId);
      return {
        visible: routeLine !== undefined,
        tiles: walker ? walker.path.slice(walker.step) : [],
      };
    },
    getSettlers: () =>
      walkers.map((walker) => ({
        id: walker.id,
        x: walker.x,
        z: walker.z,
        tile: getStandingTile(walker),
        heading: walker.heading,
        phase: walker.phase,
        walking: walker.walking,
        pausing: walker.pause > 0,
      })),
    pick: (x, y) => {
      if (walkers.length === 0) {
        return undefined;
      }
      for (const part of parts) {
        // Babylon keeps the matrices it picks with from the first pick on, and
        // the bounds of the base mesh do not follow the instances either
        const picked = part.mesh.thinInstanceGetWorldMatrices();
        for (let i = 0; i < walkers.length; i++) {
          Matrix.FromArrayToRef(part.matrices, i * 16, picked[i]);
        }
        part.mesh.thinInstanceRefreshBoundingInfo(false);
      }
      const hit = scene.pick(
        x,
        y,
        (mesh) => mesh === body.mesh || mesh === head.mesh,
      );
      return hit?.hit ? walkers[hit.thinInstanceIndex]?.id : undefined;
    },
    select: (id) => {
      selectedId = id;
      moveMarker();
      updateRouteLine();
    },
    getMarker: () => ({ id: selectedId, visible: marker.isEnabled() }),
    getActivity: (id) => {
      const walker = walkers.find((w) => w.id === id);
      return walker && getActivity(walker);
    },
    getTriangleCount: () =>
      parts.reduce((sum, part) => sum + part.mesh.getTotalIndices() / 3, 0),
    getMeshCount: () => parts.length,
  };
}
