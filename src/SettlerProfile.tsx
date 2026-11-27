import { useEffect, useState, type FC } from "react";
import type { HexCoordinates, PlacedBuilding } from "./board";
import { ageInWeek, formatShortTime } from "./calendar";
import type { Resident } from "./settlers";

const REFRESH_MS = 200;

export const SettlerProfile: FC<{
  resident: Resident;
  week: number; // the current in-game week
  home: PlacedBuilding | undefined;
  getActivity: (id: number) => "Walking" | "Idle" | undefined;
  onOpenHome: (center: HexCoordinates) => void;
  onClose: () => void;
}> = ({ resident, week, home, getActivity, onOpenHome, onClose }) => {
  // the activity changes with the animation, not with the game state
  const [activity, setActivity] = useState(() => getActivity(resident.id));
  useEffect(() => {
    const update = () => setActivity(getActivity(resident.id));
    update();
    const interval = setInterval(update, REFRESH_MS);
    return () => clearInterval(interval);
  }, [resident.id, getActivity]);
  return (
    <article className="hud-glass hud-panel" data-testid="settler-profile">
      <div className="row no-wrap">
        <div className="max">
          <h6 className="no-margin" data-testid="settler-name">
            {resident.name}
          </h6>
          <div className="small-text" data-testid="settler-age">
            Age {ageInWeek(resident.birthDate, week)}
          </div>
          <div className="small-text" data-testid="settler-born">
            Born {formatShortTime(resident.birthDate)}
          </div>
          <div className="small-text" data-testid="settler-activity">
            {activity}
          </div>
          <div className="small-text" data-testid="settler-home">
            Home:{" "}
            {home ? (
              <a
                href="#"
                data-testid="settler-home-link"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenHome(home.center);
                }}
              >
                {home.building.name}
              </a>
            ) : (
              "Unhoused"
            )}
          </div>
        </div>
        <button
          className="circle transparent small"
          aria-label="Close settler profile"
          onClick={onClose}
        >
          <i aria-hidden="true">close</i>
        </button>
      </div>
    </article>
  );
};
