import "beercss/dist/cdn/beer.min.css";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Map } from "./Map";
import { BuildButton, BuildList } from "./Menu";
import { getPlacedBuilding, type HexCoordinates } from "./board";
import {
  BuildingDefinition,
  type BuildingCategory,
  type BuildingType,
} from "./gameDefinitions";
import {
  build,
  calculateWeek,
  canBuild,
  getBuildingReport,
  getState,
  takeCompletedBuildings,
} from "./game";
import { BuildingDetailsPanel } from "./BuildingDetailsPanel";
import { BuildingInfo } from "./BuildingInfo";
import { StatusBar } from "./StatusBar";

export const App: FC = () => {
  const [state, setState] = useState(getState);

  const mapRef = useRef<{
    addBuilding: (
      coords: HexCoordinates,
      type: BuildingType,
      underConstruction?: boolean,
    ) => void;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(calculateWeek());
      // the model of a finished building replaces its construction site
      for (const { coords, type } of takeCompletedBuildings()) {
        mapRef.current?.addBuilding(coords, type);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const [selectedBuildingType, setSelectedBuildingType] = useState<
    BuildingType | undefined
  >();
  // mirrors the state so that the stable map listener can read it
  const selectedBuildingTypeRef = useRef<BuildingType | undefined>(undefined);
  const [detailsHidden, setDetailsHidden] = useState(false);
  const hideDetails = useCallback(() => setDetailsHidden(true), []);
  // center of the placed building whose last week is shown
  const [infoCenter, setInfoCenter] = useState<HexCoordinates | undefined>();
  const infoCenterRef = useRef<HexCoordinates | undefined>(undefined);
  const showInfo = useCallback((center: HexCoordinates | undefined) => {
    infoCenterRef.current = center;
    setInfoCenter(center);
  }, []);
  const selectBuildingType = useCallback(
    (type: BuildingType | undefined) => {
      selectedBuildingTypeRef.current = type;
      setSelectedBuildingType(type);
      if (type) setDetailsHidden(false);
      showInfo(undefined);
    },
    [showInfo],
  );
  const mapSelectionListener = useCallback(
    (coords: HexCoordinates) => {
      const type = selectedBuildingTypeRef.current;
      if (type) {
        if (canBuild(type, coords)) {
          build(type, coords);
          setState(getState());
          // buildings without construction work are finished immediately
          mapRef.current?.addBuilding(
            coords,
            type,
            BuildingDefinition[type].cost.labor > 0,
          );
          selectBuildingType(undefined);
        }
        return;
      }
      const placed = getPlacedBuilding(coords);
      const current = infoCenterRef.current;
      const isSame =
        placed &&
        current &&
        placed.center.q === current.q &&
        placed.center.r === current.r;
      showInfo(
        placed && placed.building.type !== "Forest" && !isSame
          ? placed.center
          : undefined,
      );
    },
    [selectBuildingType, showInfo],
  );
  const [buildOpen, setBuildOpen] = useState(false);
  const [category, setCategory] = useState<BuildingCategory>("FARM");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBuildOpen(false);
        selectBuildingType(undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectBuildingType]);
  const closeInfo = useCallback(() => showInfo(undefined), [showInfo]);
  const infoPlaced = infoCenter && getPlacedBuilding(infoCenter);
  return (
    <>
      <main className="no-padding py-1">
        <Map
          ref={mapRef}
          onSelected={mapSelectionListener}
          previewType={selectedBuildingType}
          residents={state.residents}
        />
      </main>
      <div className="hud-root">
        <div className="hud-top">
          <BuildButton
            open={buildOpen}
            selected={selectedBuildingType}
            onToggle={() => setBuildOpen(!buildOpen)}
          />
          <StatusBar state={state} />
        </div>
        <div className="hud-areas">
          <div className="hud-left">
            {buildOpen && (
              <BuildList
                category={category}
                selected={selectedBuildingType}
                resources={state.resources}
                onCategory={setCategory}
                onSelect={selectBuildingType}
              />
            )}
            {selectedBuildingType && !detailsHidden && (
              <BuildingDetailsPanel
                type={selectedBuildingType}
                resources={state.resources}
                onHide={hideDetails}
              />
            )}
          </div>
          <div className="hud-right">
            {infoPlaced && (
              <BuildingInfo
                building={infoPlaced.building}
                center={infoPlaced.center}
                report={getBuildingReport(infoPlaced.center)}
                population={state.population}
                housing={state.housing}
                onClose={closeInfo}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
