import { useEffect, useState, type FC } from "react";
import type { Resident } from "./settlers";

const REFRESH_MS = 200;

export const SettlerProfile: FC<{
  resident: Resident;
  getActivity: (id: number) => "Walking" | "Idle" | undefined;
  onClose: () => void;
}> = ({ resident, getActivity, onClose }) => {
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
            {resident.age} years
          </div>
          <div className="small-text" data-testid="settler-activity">
            {activity}
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
