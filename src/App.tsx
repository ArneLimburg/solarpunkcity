import "beercss/dist/cdn/beer.min.css";
import { useCallback, useRef, useState, type FC } from "react";
import { Map } from "./Map";
import { Menu } from "./Menu";
import { GRID_RADIUS, type HexCoordinates } from "./board";
import { BuildingTypes, type BuildingType, type Model } from "./game";

export const App: FC = () => {
  const mapRef = useRef<{
    addBuilding: (coords: HexCoordinates, model: Model) => void;
  } | null>(null);
  const [selectedBuildingType, setSelectedBuildingType] = useState<
    BuildingType | undefined
  >();
  const buildingTypeSelectionListener = useCallback(
    (buildingType: BuildingType) => setSelectedBuildingType(buildingType),
    [setSelectedBuildingType],
  );
  const mapSelectionListener = useCallback((coords: HexCoordinates) => {
    setSelectedBuildingType((selectedBuildingType) => {
      if (
        selectedBuildingType &&
        Math.abs(coords.q + coords.r) <= GRID_RADIUS
      ) {
        mapRef.current?.addBuilding(
          coords,
          BuildingTypes[selectedBuildingType].model,
        );
        return undefined;
      } else {
        return selectedBuildingType;
      }
    });
  }, []);
  return (
    <>
      <Menu
        selected={selectedBuildingType}
        onSelect={buildingTypeSelectionListener}
      />
      <main className="no-padding py-1">
        <Map ref={mapRef} onSelected={mapSelectionListener} />
      </main>
    </>
  );
};
