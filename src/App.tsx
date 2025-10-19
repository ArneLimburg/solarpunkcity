import "beercss/dist/cdn/beer.min.css";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Map } from "./Map";
import { Menu } from "./Menu";
import { GRID_RADIUS, type HexCoordinates } from "./board";
import {
  BuildingTypes,
  type BuildingType,
  type Model,
} from "./gameDefinitions";
import { build, calculateWeek, canBuild } from "./game";
import { emptyResources } from "./resources";

export const App: FC = () => {
  const [currentPopulation, setCurrentPopulation] = useState(0);
  const [currentResources, setCurrentResources] = useState({
    ...emptyResources,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const { resources, population } = calculateWeek();
      setCurrentResources({ ...resources });
      setCurrentPopulation(population);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log(`population: ${currentPopulation}`);
  }, [currentPopulation]);

  useEffect(() => {
    for (const [key, value] of Object.entries(currentResources)) {
      if (value > 0) {
        console.log(`${key}: ${value}`);
      }
    }
  }, [currentResources]);

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
        Math.abs(coords.q + coords.r) <= GRID_RADIUS &&
        canBuild(selectedBuildingType, coords)
      ) {
        build(selectedBuildingType, coords);
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
        <Map
          ref={mapRef}
          onInitialized={() => {}}
          onSelected={mapSelectionListener}
        />
      </main>
    </>
  );
};
