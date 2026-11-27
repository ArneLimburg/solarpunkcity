import { useEffect, useState, type FC, type ReactNode } from "react";
import type { GameState } from "./game";
import { chipClassName } from "./buildingDetails";
import { formatLongDate, formatSessionTime, formatShortDate } from "./calendar";
import {
  formatConstructionSites,
  formatEnergy,
  formatFood,
  formatFreeRow,
  formatPercent,
  formatPlanks,
  formatPopulation,
  formatSatisfactionDetail,
  formatWood,
  formatWorkersButton,
  getFurtherStocks,
} from "./hudFormat";
import { resourceIcons } from "./resourceIcons";

const Entry: FC<{
  name: string;
  icon: string;
  value: string;
  error?: boolean;
}> = ({ name, icon, value, error }) => (
  <span
    className={chipClassName(error)}
    title={name}
    aria-label={name}
    data-testid={`status-${name}`}
  >
    <i aria-hidden="true">{icon}</i>
    <span>{value}</span>
  </span>
);

const Row: FC<{
  name: string;
  value: string;
  detail?: string;
  icon?: string;
  error?: boolean;
}> = ({ name, value, detail, icon, error }) => (
  <div data-testid={`row-${name}`} className={error ? "error-text" : undefined}>
    <div className="row no-wrap">
      {icon && <i aria-hidden="true">{icon}</i>}
      <span className="max">{name}</span>
      <span>{value}</span>
    </div>
    {detail && <div className="small-text">{detail}</div>}
  </div>
);

type Dropdown = "workers" | "more" | "date";

// mounted only while the dropdown is open: reads the clock when it opens and
// refreshes every second
const SessionTime: FC<{ sessionStart: number }> = ({ sessionStart }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Row name="Session time" value={formatSessionTime(now - sessionStart)} />
  );
};

const DropdownButton: FC<{
  id: Dropdown;
  open: boolean;
  error: boolean;
  label: string;
  onToggle: (id: Dropdown) => void;
  children: ReactNode;
}> = ({ id, open, error, label, onToggle, children }) => (
  <div className="hud-dropdown" data-hud>
    <button
      className={`border small ${error ? "error" : ""}`}
      aria-expanded={open}
      aria-controls={`hud-${id}`}
      data-testid={`hud-${id}-button`}
      onClick={() => onToggle(id)}
    >
      {label}
    </button>
    {open && (
      <div
        id={`hud-${id}`}
        className="hud-glass hud-panel hud-dropdown-panel"
        data-testid={`hud-${id}`}
      >
        {children}
      </div>
    )}
  </div>
);

export const StatusBar: FC<{ state: GameState; sessionStart: number }> = ({
  state,
  sessionStart,
}) => {
  const [open, setOpen] = useState<Dropdown | undefined>();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(undefined);
    };
    // does not stop the event, so the map still handles it
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".hud-dropdown")
      ) {
        setOpen(undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);
  const toggle = (id: Dropdown) => setOpen(open === id ? undefined : id);
  const { workforce } = state;
  const stocks = getFurtherStocks(state.resources);
  return (
    <div
      className="hud-glass hud"
      data-testid="hud"
      data-hud
      style={{ pointerEvents: "auto" }}
    >
      <div className="row no-wrap center-align">
        <Entry
          name="population"
          icon="groups"
          value={formatPopulation(state)}
        />
        <Entry
          name="food"
          icon={resourceIcons.food}
          value={formatFood(state)}
          error={state.foodBalance < 0}
        />
        <Entry
          name="wood"
          icon={resourceIcons.wood}
          value={formatWood(state)}
          error={state.capacity.wood === 0}
        />
        {state.capacity.planks > 0 && (
          <Entry
            name="planks"
            icon={resourceIcons.planks}
            value={formatPlanks(state)}
          />
        )}
        {(state.energyProduced > 0 || state.energyUsed > 0) && (
          <Entry
            name="energy"
            icon={resourceIcons.energy}
            value={formatEnergy(state)}
            error={state.buildingsWithoutEnergy > 0}
          />
        )}
      </div>
      <div className="row no-wrap center-align">
        <DropdownButton
          id="workers"
          open={open === "workers"}
          error={state.laborFactor < 100}
          label={formatWorkersButton(state)}
          onToggle={toggle}
        >
          <h6 className="no-margin small">Last week</h6>
          {workforce ? (
            <>
              <Row name="Food production" value={String(workforce.food)} />
              <Row name="Construction" value={String(workforce.construction)} />
              <Row name="Production" value={String(workforce.production)} />
              <Row name="Forestry" value={String(workforce.forestry)} />
              <Row name="Free" value={formatFreeRow(state, workforce)} />
            </>
          ) : (
            <div>No weekly report yet</div>
          )}
        </DropdownButton>
        <DropdownButton
          id="more"
          open={open === "more"}
          error={state.sitesWaitingForWood > 0}
          label="More"
          onToggle={toggle}
        >
          <Row name="Ecology" icon="eco" value={formatPercent(state.ecology)} />
          <Row
            name="Satisfaction"
            icon="sentiment_satisfied"
            value={formatPercent(state.satisfaction)}
            detail={formatSatisfactionDetail(state)}
          />
          <Row
            name="Construction sites"
            icon="construction"
            value={formatConstructionSites(state)}
            error={state.sitesWaitingForWood > 0}
          />
          {stocks.map((name) => (
            <Row
              key={name}
              name={name}
              icon={resourceIcons[name]}
              value={String(Math.floor(state.resources[name]))}
            />
          ))}
        </DropdownButton>
        <DropdownButton
          id="date"
          open={open === "date"}
          error={false}
          label={formatShortDate(state.week)}
          onToggle={toggle}
        >
          <Row name="Date" value={formatLongDate(state.week)} />
          <Row name="Week" value={`Week ${state.week} since founding`} />
          <SessionTime sessionStart={sessionStart} />
        </DropdownButton>
      </div>
    </div>
  );
};
