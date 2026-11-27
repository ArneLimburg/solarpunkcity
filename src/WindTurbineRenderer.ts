import type { Scene } from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import type { FarmRenderer, ModelType } from "./FarmRenderer";
import { TILE_TOP, tileKey } from "./hexGeometry";
import { getRotorAngle, getRotorMatrix } from "./windTurbine";

// what differs between the turbines: the model whose last template is the
// rotor, its speed and the axis through its hub
export type RotorOptions = {
  type: ModelType;
  rpm: number;
  hub: { y: number; z: number };
};

export type WindTurbineRenderer = {
  // shows a finished wind turbine with a turning rotor on the center tile
  create: (
    coords: HexCoordinates,
    center: { x: number; z: number },
  ) => { dispose: () => void; triangles: number };
  // the current rotor matrix of the turbine on a tile (DEV hooks)
  getRotorMatrix: (coords: HexCoordinates) => number[] | undefined;
};

type Turbine = {
  coords: HexCoordinates;
  center: { x: number; z: number };
};

// Shows the towers as instances of the template and all rotors as thin
// instances of one mesh whose matrices are updated every frame, so any number
// of wind turbines needs two draw calls and no new meshes or materials.
export function createWindTurbineRenderer(
  scene: Scene,
  farms: FarmRenderer,
  hexSize: number,
  // the time in seconds, real time and independent of the game speed
  now: () => number,
  { type, rpm, hub }: RotorOptions,
): WindTurbineRenderer {
  const templates = farms.getMeshes(type);
  const rotorTemplate = templates[templates.length - 1];
  const towers = templates.slice(0, -1);
  const rotor = rotorTemplate.clone(`${type}Rotor`);
  rotor.isVisible = false;
  rotor.isPickable = false;
  // the bounds of the template do not cover the instances
  rotor.alwaysSelectAsActiveMesh = true;
  const triangles = farms.getTriangles(type);
  let turbines: Turbine[] = [];
  let matrices = new Float32Array(0);

  const update = () => {
    const seconds = now();
    turbines.forEach(({ coords, center }, index) => {
      matrices.set(
        getRotorMatrix(
          center,
          getRotorAngle(coords, seconds, rpm),
          hexSize,
          hub,
        ),
        index * 16,
      );
    });
    rotor.thinInstanceBufferUpdated("matrix");
  };
  scene.onBeforeRenderObservable.add(() => {
    if (turbines.length > 0) {
      update();
    }
  });

  // a new buffer after turbines were added or removed
  const resize = () => {
    matrices = new Float32Array(turbines.length * 16);
    rotor.thinInstanceSetBuffer("matrix", matrices, 16, false);
    rotor.isVisible = turbines.length > 0;
    update();
  };

  return {
    create: (coords, center) => {
      const turbine = { coords, center };
      turbines = [...turbines, turbine];
      resize();
      const instances = towers.map((tower) => {
        const instance = tower.createInstance(`${tower.name}_instance`);
        instance.position.set(center.x, TILE_TOP, center.z);
        instance.isPickable = false;
        return instance;
      });
      return {
        dispose: () => {
          instances.forEach((instance) => instance.dispose());
          turbines = turbines.filter((other) => other !== turbine);
          resize();
        },
        triangles,
      };
    },
    getRotorMatrix: (coords) => {
      const index = turbines.findIndex(
        (turbine) => tileKey(turbine.coords) === tileKey(coords),
      );
      return index < 0
        ? undefined
        : Array.from(matrices.subarray(index * 16, index * 16 + 16));
    },
  };
}
