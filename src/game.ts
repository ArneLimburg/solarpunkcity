export const GRID_RADIUS = 30; // how many rings around center of the field

export type HexCoordinates = {
  q: number;
  r: number;
};

export type HexLocation = {
  coordinates: HexCoordinates;
};
