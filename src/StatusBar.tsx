import type { FC } from "react";
import type { GameState } from "./game";
import { resourceIcons, stockResources } from "./resourceIcons";

const Entry: FC<{
  name: string;
  icon: string;
  value: string;
  error?: boolean;
}> = ({ name, icon, value, error }) => (
  <span
    className={error ? "chip no-margin error" : "chip no-margin"}
    title={name}
    aria-label={name}
    data-testid={`status-${name}`}
  >
    <i>{icon}</i>
    <span>{value}</span>
  </span>
);

export const StatusBar: FC<{ state: GameState }> = ({ state }) => (
  <nav
    className="bottom small-opacity"
    data-testid="status-bar"
    style={{
      position: "static",
      flexWrap: "wrap",
      height: "auto",
      minHeight: "3rem",
      pointerEvents: "auto",
    }}
  >
    <Entry
      name="population"
      icon="groups"
      value={`${Math.floor(state.population)} / ${Math.floor(state.housing)}`}
    />
    <Entry
      name="labor"
      icon={resourceIcons.labor}
      value={`${Math.floor(state.resources.labor)}`}
    />
    <Entry
      name="food"
      icon={resourceIcons.food}
      value={`${Math.floor(state.resources.food)} (${
        state.foodBalance < 0 ? "−" : "+"
      }${Math.floor(Math.abs(state.foodBalance))})`}
      error={state.foodBalance < 0}
    />
    <Entry name="ecology" icon="eco" value={`${Math.floor(state.ecology)} %`} />
    <Entry
      name="satisfaction"
      icon="sentiment_satisfied"
      value={`${Math.floor(state.satisfaction)} %`}
    />
    {stockResources.map((name) =>
      state.resources[name] > 0 ? (
        <Entry
          key={name}
          name={name}
          icon={resourceIcons[name]}
          value={`${Math.floor(state.resources[name])}`}
        />
      ) : null,
    )}
  </nav>
);
