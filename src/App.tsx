import { useRef, type FC } from "react";
import { Map } from "./Map";
import { GRID_RADIUS, type HexCoordinates } from "./game";

export const App: FC = () => {
  const mapRef = useRef<{
    addBuilding: (coords: HexCoordinates) => void;
  } | null>(null);
  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}>
      <Map
        ref={mapRef}
        onSelected={(coords) => {
          if (Math.abs(coords.q + coords.r) <= GRID_RADIUS) {
            mapRef.current?.addBuilding(coords);
          }
        }}
      />
    </div>
  );
};
