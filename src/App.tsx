import "beercss/dist/cdn/beer.min.css";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Map } from "./Map";
import { BuildButton, BuildList } from "./Menu";
import {
  getConstructionSites,
  getPlacedBuilding,
  type HexCoordinates,
} from "./board";
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
  getConstructionReport,
  getFieldEfficiency,
  getHome,
  getOccupants,
  getState,
  getStoredWood,
  takeCompletedBuildings,
} from "./game";
import { BuildingDetailsPanel } from "./BuildingDetailsPanel";
import { BuildingInfo } from "./BuildingInfo";
import { SettlerProfile } from "./SettlerProfile";
import { StatusBar } from "./StatusBar";

export const App: FC = () => {
  const [state, setState] = useState(getState);
  // wall clock start of this run, for the session time
  const [sessionStart] = useState(() => Date.now());

  const mapRef = useRef<{
    addBuilding: (
      coords: HexCoordinates,
      type: BuildingType,
      underConstruction?: boolean,
    ) => void;
    setProgress: (center: HexCoordinates, percent: number) => void;
    getSettlerActivity: (id: number) => "Walking" | "Idle" | undefined;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(calculateWeek());
      // the model of a finished building replaces its construction site
      for (const { coords, type } of takeCompletedBuildings()) {
        mapRef.current?.addBuilding(coords, type);
      }
      // the remaining sites fill up with their progress
      for (const { center } of getConstructionSites()) {
        mapRef.current?.setProgress(
          center,
          getConstructionReport(center)!.percent,
        );
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
  // the selected settler (resident ID)
  const [settlerId, setSettlerId] = useState<number | undefined>();
  const selectSettler = useCallback(
    (id: number) => {
      setSettlerId(id);
      showInfo(undefined);
    },
    [showInfo],
  );
  const closeSettler = useCallback(() => setSettlerId(undefined), []);
  // the profile's home link: switches back to the info panel of the building
  const openHome = useCallback(
    (center: HexCoordinates) => {
      setSettlerId(undefined);
      showInfo(center);
    },
    [showInfo],
  );
  const getSettlerActivity = useCallback(
    (id: number) => mapRef.current!.getSettlerActivity(id),
    [],
  );
  const selectBuildingType = useCallback(
    (type: BuildingType | undefined) => {
      selectedBuildingTypeRef.current = type;
      setSelectedBuildingType(type);
      if (type) {
        setDetailsHidden(false);
        setSettlerId(undefined);
      }
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
          // the building stays selected for the next copy
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
      const opens = placed && placed.building.type !== "Forest" && !isSame;
      showInfo(opens ? placed.center : undefined);
      if (opens) {
        setSettlerId(undefined); // one panel at a time
      }
    },
    [showInfo],
  );
  const [buildOpen, setBuildOpen] = useState(false);
  const [category, setCategory] = useState<BuildingCategory>("FARM");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBuildOpen(false);
        selectBuildingType(undefined);
        setSettlerId(undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectBuildingType]);
  const closeInfo = useCallback(() => showInfo(undefined), [showInfo]);
  const infoPlaced = infoCenter && getPlacedBuilding(infoCenter);
  const construction = infoPlaced && getConstructionReport(infoPlaced.center);
  // a resident who left the population has no profile and no marker
  const settler = state.residents.find(({ id }) => id === settlerId);
  return (
    <>
      <main className="no-padding py-1">
        <Map
          ref={mapRef}
          onSelected={mapSelectionListener}
          previewType={selectedBuildingType}
          residents={state.residents}
          onSettlerSelected={selectSettler}
          selectedSettler={settler?.id}
          progress={
            construction
              ? { center: infoPlaced!.center, percent: construction.percent }
              : undefined
          }
        />
      </main>
      <div className="hud-root">
        <div className="hud-top">
          <BuildButton
            open={buildOpen}
            selected={selectedBuildingType}
            onToggle={() => setBuildOpen(!buildOpen)}
          />
          <StatusBar state={state} sessionStart={sessionStart} />
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
          <div className={settler ? "hud-right hud-right-top" : "hud-right"}>
            {settler && (
              <SettlerProfile
                resident={settler}
                week={state.week}
                home={getHome(settler.id)}
                getActivity={getSettlerActivity}
                onOpenHome={openHome}
                onClose={closeSettler}
              />
            )}
            {infoPlaced && (
              <BuildingInfo
                building={infoPlaced.building}
                center={infoPlaced.center}
                report={getBuildingReport(infoPlaced.center)}
                occupants={getOccupants(infoPlaced)}
                construction={construction}
                storedWood={getStoredWood(infoPlaced.center)}
                fieldEfficiency={getFieldEfficiency()}
                onSelectResident={selectSettler}
                onClose={closeInfo}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
