import "beercss/dist/cdn/beer.min.css";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Map } from "./map/Map";
import { Menu } from "./Menu";
import {
  getBuildingLocations,
  getBuildings,
  GRID_RADIUS,
  type HexCoordinates,
} from "./board";
import {
  BuildingTypes,
  type BuildingType,
  type Model,
} from "./gameDefinitions";
import { build, calculateWeek, canBuild } from "./game.js";
import { emptyResources } from "./resources";

export const AppState = {
  PreloadModels: "PreloadModels",
  InitializeScene: "InitializeScene",
  Ready: "Ready",
} as const;

export type AppState = keyof typeof AppState;

export const App: FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.PreloadModels);
  const [currentPopulation, setCurrentPopulation] = useState(0);
  const [currentResources, setCurrentResources] = useState({
    ...emptyResources,
  });

  useEffect(() => {
    if (appState === AppState.Ready) {
      console.log("Game started");
      const interval = setInterval(() => {
        const { resources, population } = calculateWeek();
        setCurrentResources({ ...resources });
        setCurrentPopulation(population);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [appState]);

  useEffect(() => {
    if (appState === AppState.Ready) {
      console.log(`population: ${currentPopulation}`);
    }
  }, [appState, currentPopulation]);

  useEffect(() => {
    if (appState === AppState.Ready) {
      for (const [key, value] of Object.entries(currentResources)) {
        if (value > 0) {
          console.log(`${key}: ${value}`);
        }
      }
    }
  }, [appState, currentResources]);

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
  const mapSelectionListener = useCallback(
    (coords: HexCoordinates) => {
      if (appState === "Ready") {
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
      }
    },
    [appState],
  );
  useEffect(() => {
    if (appState === AppState.InitializeScene && mapRef.current) {
      console.log("Initializing scene with existing buildings");
      const buildingEntries = Array.from(getBuildingLocations()); // Map -> Array
      const total = buildingEntries.length;

      buildingEntries.forEach(([coordinates, building], index) => {
        mapRef.current?.addBuilding(
          coordinates,
          BuildingTypes[building.type].model,
        );

        // Prozent berechnen
        const percent = Math.round(((index + 1) / total) * 100);
        console.log(`Loading buildings: ${percent}%`);
      });
      setAppState(AppState.Ready);
    }
  }, [appState, mapRef]);

  return (
    <>
      <Menu
        selected={selectedBuildingType}
        onSelect={buildingTypeSelectionListener}
      />
      <main className="no-padding py-1">
        <Map
          ref={mapRef}
          onSelected={mapSelectionListener}
          onPreloadingFinished={() => setAppState(AppState.InitializeScene)}
        />
      </main>
    </>
  );
};
