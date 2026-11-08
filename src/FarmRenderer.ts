import {
  Color3,
  Mesh,
  StandardMaterial,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { buildGeometry } from "./farmGeometry";
import { getApartmentLayout } from "./apartment";
import { TILE_TOP } from "./hexGeometry";
import {
  GLASS_ALPHA,
  getFarmLayout,
  isFarmType,
  type FarmPart,
  type FarmType,
} from "./farms";

// building types whose model is built from code
export type ModelType = FarmType | "AppartmentBuilding";

export function isModelType(type: string): type is ModelType {
  return isFarmType(type as FarmType) || type === "AppartmentBuilding";
}

function getLayout(type: ModelType, hexSize: number): FarmPart[] {
  return isFarmType(type)
    ? getFarmLayout(type, hexSize)
    : getApartmentLayout(hexSize);
}

export type FarmModel = {
  dispose: () => void;
  triangles: number;
};

export type FarmRenderer = {
  // shows a farm model on the given center tile
  create: (type: ModelType, center: { x: number; z: number }) => FarmModel;
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
    const triangles = (opaque.indices.length + glass.indices.length) / 3;
    return (templates[type] = { meshes, triangles });
  };

  return {
    create: (type, center) => {
      const template = getTemplate(type);
      const instances = template.meshes.map((mesh) => {
        const instance = mesh.createInstance(`${mesh.name}_instance`);
        instance.position.set(center.x, TILE_TOP, center.z);
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
