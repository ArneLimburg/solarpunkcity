import {
  Color3,
  MeshBuilder,
  PointerEventTypes,
  type AbstractMesh,
  type PointerInfo,
  type Scene,
} from "@babylonjs/core";
import {
  getFootprint,
  getFootprintRadius,
  isOnBoard,
  type HexCoordinates,
} from "./board";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import { canPlace, fitsStorage } from "./game";
import { HEX_SIZE, hexToPixel, pixelToHex } from "./hexGeometry";
import { makeMaterial } from "./TileRenderer";

export type Ring = {
  tile: HexCoordinates | null; // the hovered center tile
  tiles: HexCoordinates[]; // footprint tiles on the board
  blocked: boolean; // the ring uses the red material
  show: (coordinates: HexCoordinates, radius: number, blocked: boolean) => void;
  hide: () => void;
};

export function createRing(scene: Scene): Ring {
  const highlightMaterial = makeMaterial("hexHighlight", Color3.Black(), scene);
  highlightMaterial.alpha = 0.1;
  const blockedMaterial = makeMaterial(
    "hexBlocked",
    new Color3(0.9, 0.2, 0.2),
    scene,
  );
  blockedMaterial.alpha = 0.5;
  const meshes: Record<number, AbstractMesh> = {}; // one torus per radius
  const getMesh = (radius: number) => {
    meshes[radius] ??= MeshBuilder.CreateTorus(
      `ring_${radius}`,
      {
        thickness: 0.1,
        diameter: 2 * HEX_SIZE * (Math.sqrt(3) * radius + 1),
        tessellation: 64,
      },
      scene,
    );
    meshes[radius].isPickable = false;
    return meshes[radius];
  };
  const hideMeshes = () =>
    Object.values(meshes).forEach((mesh) => mesh.setEnabled(false));
  const ring: Ring = {
    tile: null,
    tiles: [],
    blocked: false,
    show: (coordinates, radius, blocked) => {
      hideMeshes();
      const mesh = getMesh(radius);
      const center = hexToPixel(coordinates.q, coordinates.r);
      mesh.position.set(center.x, 0.1, center.z);
      mesh.material = blocked ? blockedMaterial : highlightMaterial;
      mesh.setEnabled(true);
      ring.tiles = getFootprint(coordinates, radius).filter(isOnBoard);
      ring.blocked = blocked;
      ring.tile = { q: coordinates.q, r: coordinates.r };
    },
    hide: () => {
      hideMeshes();
      ring.tiles = [];
      ring.blocked = false;
      ring.tile = null;
    },
  };
  return ring;
}

// footprint radius and blocked state of the selected building type; without
// selection the ring is the single-tile ring and never blocked
export function createPreview(getType: () => BuildingType | undefined) {
  return {
    getRadius: () => {
      const type = getType();
      return type ? getFootprintRadius(BuildingDefinition[type].size) : 0;
    },
    isBlocked: (coordinates: HexCoordinates) => {
      const type = getType();
      return type
        ? !canPlace(type, coordinates) || !fitsStorage(type, coordinates)
        : false;
    },
  };
}

export function createLeaveHandler(ring: Ring): (event: PointerEvent) => void {
  return (event) => {
    // a touch pointer always leaves the canvas after the finger is lifted
    if (event.pointerType !== "touch") {
      ring.hide();
    }
  };
}

export function createPointerHandler(
  scene: Scene,
  ring: Ring,
  onSelected: (coordinates: HexCoordinates) => void,
  getRadius: () => number,
  isBlocked: (coordinates: HexCoordinates) => boolean,
): (pointerInfo: PointerInfo) => void {
  return (pointerInfo: PointerInfo) => {
    // Babylon sends a second tap within DoubleClickDelay only as POINTERDOUBLETAP
    const type =
      pointerInfo.type === PointerEventTypes.POINTERDOUBLETAP
        ? PointerEventTypes.POINTERTAP
        : pointerInfo.type;
    if (
      type !== PointerEventTypes.POINTERMOVE &&
      type !== PointerEventTypes.POINTERTAP
    ) {
      return;
    }
    const event = pointerInfo.event as PointerEvent;
    const isTouch = event.pointerType === "touch";
    if (type === PointerEventTypes.POINTERMOVE && isTouch) {
      return; // touch only moves the ring by tapping
    }
    if (type === PointerEventTypes.POINTERTAP && event.button !== 0) {
      return;
    }

    // Babylon does not pick on pointer move, so pick explicitly
    const pick =
      type === PointerEventTypes.POINTERMOVE
        ? scene.pick(scene.pointerX, scene.pointerY)
        : pointerInfo.pickInfo;
    const coordinates =
      pick && pick.hit && pick.pickedPoint
        ? pixelToHex(pick.pickedPoint)
        : undefined;
    if (!coordinates || !isOnBoard(coordinates)) {
      ring.hide();
      return;
    }

    if (type === PointerEventTypes.POINTERMOVE) {
      ring.show(coordinates, getRadius(), isBlocked(coordinates));
      return;
    }

    const ringIsHere =
      ring.tile?.q === coordinates.q && ring.tile?.r === coordinates.r;
    ring.show(coordinates, getRadius(), isBlocked(coordinates));
    if (!isTouch || ringIsHere) {
      onSelected(coordinates);
    }
  };
}
