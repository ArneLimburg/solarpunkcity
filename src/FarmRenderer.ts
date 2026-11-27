import {
  Color3,
  Mesh,
  StandardMaterial,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { buildGeometry } from "./farmGeometry";
import { getApartmentLayout, getApartmentRotorLayout } from "./apartment";
import { getHydroPowerPlantLayout } from "./hydroPowerPlant";
import { getSawmillLayout } from "./sawmill";
import { getWoodenHouseLayout } from "./woodenHouse";
import { getWindTurbineLayout, getWindTurbineRotorLayout } from "./windTurbine";
import { getSupermarketLayout } from "./supermarket";
import { getSettlersCampLayout } from "./settlersCamp";
import { TILE_TOP } from "./hexGeometry";
import {
  GLASS_ALPHA,
  getFarmLayout,
  isFarmType,
  type FarmPart,
  type FarmType,
} from "./farms";

// building types whose model is built from code
export type ModelType =
  | FarmType
  | "AppartmentBuilding"
  | "WoodenHouse"
  | "SettlersCamp"
  | "Sawmill"
  | "Supermarket"
  | "HydroPowerPlant"
  | "WindTurbine";

export function isModelType(type: string): type is ModelType {
  return (
    isFarmType(type as FarmType) ||
    type === "AppartmentBuilding" ||
    type === "WoodenHouse" ||
    type === "SettlersCamp" ||
    type === "Sawmill" ||
    type === "Supermarket" ||
    type === "HydroPowerPlant" ||
    type === "WindTurbine"
  );
}

function getLayout(type: ModelType, hexSize: number): FarmPart[] {
  if (isFarmType(type)) {
    return getFarmLayout(type, hexSize);
  }
  if (type === "Sawmill") {
    return getSawmillLayout(hexSize);
  }
  if (type === "WoodenHouse") {
    return getWoodenHouseLayout(hexSize);
  }
  if (type === "Supermarket") {
    return getSupermarketLayout(hexSize);
  }
  if (type === "HydroPowerPlant") {
    return getHydroPowerPlantLayout(hexSize);
  }
  if (type === "WindTurbine") {
    return getWindTurbineLayout(hexSize);
  }
  return type === "SettlersCamp"
    ? getSettlersCampLayout(hexSize)
    : getApartmentLayout(hexSize);
}

export type FarmModel = {
  dispose: () => void;
  triangles: number;
};

export type FarmRenderer = {
  // shows a farm model on the given center tile, turned around Y by rotation
  create: (
    type: ModelType,
    center: { x: number; z: number },
    rotation?: number,
  ) => FarmModel;
  // the template meshes of a type (shared geometry, not shown themselves)
  getMeshes: (type: ModelType) => Mesh[];
  // the triangles of all template meshes of a type
  getTriangles: (type: ModelType) => number;
};

type Template = { meshes: Mesh[]; triangles: number };

function createMesh(
  name: string,
  geometry: ReturnType<typeof buildGeometry>,
  alpha: number,
  scene: Scene,
): Mesh {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = geometry.positions;
  data.normals = geometry.normals;
  data.colors = geometry.colors;
  data.indices = geometry.indices;
  data.applyToMesh(mesh);
  const material = new StandardMaterial(`${name}Material`, scene);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  material.alpha = alpha;
  mesh.material = material;
  mesh.isPickable = false;
  // only the instances are shown
  mesh.isVisible = false;
  return mesh;
}

// Builds each farm type once (an opaque and a glass mesh) and shows it with
// instances that share the geometry.
export function createFarmRenderer(
  scene: Scene,
  hexSize: number,
): FarmRenderer {
  const templates: Partial<Record<ModelType, Template>> = {};

  const getTemplate = (type: ModelType): Template => {
    const existing = templates[type];
    if (existing) {
      return existing;
    }
    const parts = getLayout(type, hexSize);
    const opaque = buildGeometry(parts.filter((p) => p.color !== "glass"));
    const glass = buildGeometry(parts.filter((p) => p.color === "glass"));
    const meshes = [createMesh(`${type}`, opaque, 1, scene)];
    if (glass.indices.length > 0) {
      meshes.push(createMesh(`${type}Glass`, glass, GLASS_ALPHA, scene));
    }
    let triangles = (opaque.indices.length + glass.indices.length) / 3;
    if (type === "WindTurbine" || type === "AppartmentBuilding") {
      // the rotor is its own mesh (at angle 0, the last template): the
      // WindTurbineRenderer turns it, blueprints and holograms show it at rest
      const rotor = buildGeometry(
        type === "WindTurbine"
          ? getWindTurbineRotorLayout(hexSize)
          : getApartmentRotorLayout(hexSize),
      );
      meshes.push(createMesh(`${type}Rotor`, rotor, 1, scene));
      triangles += rotor.indices.length / 3;
    }
    return (templates[type] = { meshes, triangles });
  };

  return {
    getMeshes: (type) => getTemplate(type).meshes,
    getTriangles: (type) => getTemplate(type).triangles,
    create: (type, center, rotation = 0) => {
      const template = getTemplate(type);
      const instances = template.meshes.map((mesh) => {
        const instance = mesh.createInstance(`${mesh.name}_instance`);
        instance.position.set(center.x, TILE_TOP, center.z);
        instance.rotation.y = rotation;
        instance.isPickable = false;
        return instance;
      });
      return {
        dispose: () => instances.forEach((instance) => instance.dispose()),
        triangles: template.triangles,
      };
    },
  };
}
