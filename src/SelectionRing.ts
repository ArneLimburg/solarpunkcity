import {
  Color3,
  MeshBuilder,
  PointerEventTypes,
  type PointerInfo,
  type Scene,
} from "@babylonjs/core";
import { getFootprint, isOnBoard, type HexCoordinates } from "./board";
import { hexToPixel, pixelToHex } from "./hexGeometry";
import { makeMaterial } from "./TileRenderer";

export type Ring = {
  tile: HexCoordinates | null; // the hovered center tile
  tiles: HexCoordinates[]; // all tiles with a ring (footprint on the board)
  show: (coordinates: HexCoordinates, radius: number) => void;
  hide: () => void;
};

export function createRing(scene: Scene): Ring {
  const highlightMaterial = makeMaterial("hexHighlight", Color3.Black(), scene);
  highlightMaterial.alpha = 0.1;
  const mesh = MeshBuilder.CreateTorus(
    "ring",
    { thickness: 0.1, diameter: 2, tessellation: 64 },
    scene,
  );
  mesh.position.y = 0.01;
  mesh.material = highlightMaterial;
  mesh.isPickable = false;
  mesh.setEnabled(false);
  const meshes = [mesh]; // one ring mesh per footprint tile, created on demand
  const ring: Ring = {
    tile: null,
    tiles: [],
    show: (coordinates, radius) => {
      const tiles = getFootprint(coordinates, radius).filter(isOnBoard);
      while (meshes.length < tiles.length) {
        meshes.push(mesh.clone(`ring_${meshes.length}`));
      }
      meshes.forEach((ringMesh, i) => ringMesh.setEnabled(i < tiles.length));
      tiles.forEach((tile, i) => {
        const center = hexToPixel(tile.q, tile.r);
        meshes[i].position.set(center.x, 0.1, center.z);
      });
      ring.tiles = tiles;
      ring.tile = { q: coordinates.q, r: coordinates.r };
    },
    hide: () => {
      meshes.forEach((ringMesh) => ringMesh.setEnabled(false));
      ring.tiles = [];
      ring.tile = null;
    },
  };
  return ring;
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
      ring.show(coordinates, getRadius());
      return;
    }

    const ringIsHere =
      ring.tile?.q === coordinates.q && ring.tile?.r === coordinates.r;
    ring.show(coordinates, getRadius());
    if (!isTouch || ringIsHere) {
      onSelected(coordinates);
    }
  };
}
