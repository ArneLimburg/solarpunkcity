import "beercss/dist/cdn/beer.min.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { Map } from "./Map";
import { Menu } from "./Menu";
import type { HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import {
  build,
  calculateWeek,
  canBuild,
  getState,
  takeCompletedBuildings,
  type GameState,
} from "./game";
import { BuildingDetails } from "./BuildingDetails";
import { StatusBar } from "./StatusBar";

// Fixed bottom container: panels stack directly above the status bar,
// whatever the height of the (wrapping) status bar is.
const BottomPanel: FC<{ state: GameState; children?: ReactNode }> = ({
  state,
  children,
}) => (
  <div
    style={{
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      pointerEvents: "none",
    }}
  >
    {children}
    <StatusBar state={state} />
  </div>
);

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
  const selectBuildingType = useCallback((type: BuildingType | undefined) => {
    selectedBuildingTypeRef.current = type;
    setSelectedBuildingType(type);
    if (type) setDetailsHidden(false);
  }, []);
  const mapSelectionListener = useCallback(
    (coords: HexCoordinates) => {
      const type = selectedBuildingTypeRef.current;
      if (type && canBuild(type, coords)) {
        build(type, coords);
        setState(getState());
        mapRef.current?.addBuilding(coords, type, true);
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
          previewType={selectedBuildingType}
        />
      </main>
      <BottomPanel state={state}>
        {selectedBuildingType && !detailsHidden && (
          <BuildingDetails
            type={selectedBuildingType}
            resources={state.resources}
            onHide={hideDetails}
          />
        )}
      </BottomPanel>
    </>
  );
};
