import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import { TILE_TOP } from "./hexGeometry";
import {
  advanceWalker,
  createWalker,
  getStandingTile,
  updateWalkers,
  type Resident,
  type Walker,
} from "./settlers";

const BODY_HEIGHT = 0.2;
const HEAD_DIAMETER = 0.09;
const HEAD_FORWARD = 0.02; // the head sits a bit in front: shows the heading
const HEAD_HEIGHT = BODY_HEIGHT + HEAD_DIAMETER / 2 - 0.01;
const MAX_FRAME_SECONDS = 0.25; // a long pause (hidden tab) must not teleport anyone
const MIN_CAPACITY = 16;

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
  // the routes stay near the camp: the figures are always in view of the bounds
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

  let walkers: Walker[] = [];
  let capacity = 0;

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
  };

  scene.onBeforeRenderObservable.add(() => {
    const seconds = Math.min(
      scene.getEngine().getDeltaTime() / 1000,
      MAX_FRAME_SECONDS,
    );
    for (let i = 0; i < walkers.length; i++) {
      advanceWalker(walkers[i], seconds);
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
          createWalker(resident.id, seed ^ Math.imul(resident.id, 0x9e3779b1)),
      );
      if (walkers.length > capacity) {
        capacity = Math.max(walkers.length, capacity * 2, MIN_CAPACITY);
        for (const part of parts) {
          part.matrices = new Float32Array(capacity * 16);
          part.colors = new Float32Array(capacity * 4);
        }
      }
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
      updateWalkers(walkers);
      write();
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
    getTriangleCount: () =>
      parts.reduce((sum, part) => sum + part.mesh.getTotalIndices() / 3, 0),
    getMeshCount: () => parts.length,
  };
}
