import "beercss/dist/cdn/beer.min.css";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Map } from "./Map";
import { Menu } from "./Menu";
import { getFootprintRadius, type HexCoordinates } from "./board";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import { build, calculateWeek, canBuild, getState } from "./game";
import { StatusBar } from "./StatusBar";

export const App: FC = () => {
  const [state, setState] = useState(getState);

  useEffect(() => {
    const interval = setInterval(() => setState(calculateWeek()), 1000);

    return () => clearInterval(interval);
  }, []);

  const mapRef = useRef<{
    addBuilding: (coords: HexCoordinates, type: BuildingType) => void;
  } | null>(null);
  const [selectedBuildingType, setSelectedBuildingType] = useState<
    BuildingType | undefined
  >();
  // mirrors the state so that the stable map listener can read it
  const selectedBuildingTypeRef = useRef<BuildingType | undefined>(undefined);
  const selectBuildingType = useCallback((type: BuildingType | undefined) => {
    selectedBuildingTypeRef.current = type;
    setSelectedBuildingType(type);
  }, []);
  const mapSelectionListener = useCallback(
    (coords: HexCoordinates) => {
      const type = selectedBuildingTypeRef.current;
      if (type && canBuild(type, coords)) {
        build(type, coords);
        setState(getState());
        mapRef.current?.addBuilding(coords, type);
        selectBuildingType(undefined);
      }
    },
    [selectBuildingType],
  );
  return (
    <>
      <Menu selected={selectedBuildingType} onSelect={selectBuildingType} />
      <main className="no-padding py-1">
        <Map
          ref={mapRef}
          onSelected={mapSelectionListener}
          previewRadius={
            selectedBuildingType
              ? getFootprintRadius(
                  BuildingDefinition[selectedBuildingType].size,
                )
              : 0
          }
        />
      </main>
      <StatusBar state={state} />
    </>
  );
};
