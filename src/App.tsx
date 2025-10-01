import { useCallback, useRef, useState, type FC } from "react";
import { Map } from "./Map";
import { GRID_RADIUS, type HexCoordinates } from "./game";
import "beercss/dist/cdn/beer.min.css";
import { Menu } from "./Menu";

export const App: FC = () => {
  const mapRef = useRef<{
    addBuilding: (coords: HexCoordinates) => void;
  } | null>(null);
  const [selectedIcon, setSelectedIcon] = useState(0);
  const iconSelectionListener = useCallback(
    (icon: number) => {
      setSelectedIcon(icon);
    },
    [setSelectedIcon],
  );
  const mapSelectionListener = useCallback((coords: HexCoordinates) => {
    setSelectedIcon((selectedIcon) => {
      if (selectedIcon !== 0 && Math.abs(coords.q + coords.r) <= GRID_RADIUS) {
        mapRef.current?.addBuilding(coords);
        return 0;
      } else {
        return selectedIcon;
      }
    });
  }, []);
  return (
    <>
      <Menu selectedIcon={selectedIcon} onSelect={iconSelectionListener} />
      <main className="no-padding py-1">
        <Map ref={mapRef} onSelected={mapSelectionListener} />
      </main>
    </>
  );
};
