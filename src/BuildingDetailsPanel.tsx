import type { FC } from "react";
import {
  chipClassName,
  formatEcology,
  formatTiles,
  nonZeroResources,
  unaffordableCosts,
  woodPerBuilderWeek,
} from "./buildingDetails";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import { emptyResources, type Resources } from "./resources";
import { resourceIcons } from "./resourceIcons";

const Chip: FC<{
  name: string;
  icon: string;
  value: string;
  error?: boolean;
}> = ({ name, icon, value, error }) => (
  <span
    className={chipClassName(error)}
    title={name}
    aria-label={name}
    data-testid={`detail-${name}`}
  >
    <i>{icon}</i>
    <span>{value}</span>
  </span>
);

const noErrors: Set<keyof Resources> = new Set();

const Section: FC<{
  title: string;
  resources: Resources;
  testId: string;
  errors?: Set<keyof Resources>;
  woodSuffix?: string;
}> = ({ title, resources, testId, errors = noErrors, woodSuffix }) => {
  const entries = nonZeroResources(resources);
  if (entries.length === 0) return null;
  return (
    <div data-testid={testId}>
      <div className="small-text">{title}</div>
      <div className="row wrap">
        {entries.map(([name, value]) => (
          <Chip
            key={name}
            name={name}
            icon={resourceIcons[name]}
            value={
              name === "wood" && woodSuffix
                ? `${value} ${woodSuffix}`
                : String(value)
            }
            error={errors.has(name)}
          />
        ))}
      </div>
    </div>
  );
};

export const BuildingDetailsPanel: FC<{
  type: BuildingType;
  resources: Resources;
  onHide: () => void;
}> = ({ type, resources, onHide }) => {
  const building = BuildingDefinition[type];
  return (
    <article
      className="hud-glass hud-panel"
      data-testid="building-details"
      role="button"
      aria-label="Hide building details"
      onClick={onHide}
      style={{ position: "relative", cursor: "pointer" }}
    >
      <i
        aria-hidden="true"
        style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}
      >
        close
      </i>
      <h6 className="no-margin">{building.name}</h6>
      <p className="no-margin">{building.description}</p>
      <div className="row wrap">
        <Chip name="size" icon="hexagon" value={formatTiles(building.size)} />
        <Chip
          name="residents"
          icon="groups"
          value={String(building.resident)}
        />
        <Chip
          name="ecology"
          icon="eco"
          value={formatEcology(building.ecology)}
        />
      </div>
      <Section
        title="Cost"
        resources={building.cost}
        testId="details-cost"
        errors={unaffordableCosts(type, resources)}
        woodSuffix={building.cost.labor > 0 ? "during construction" : undefined}
      />
      {building.maxBuilders > 0 && (
        <div className="small-text" data-testid="details-builders">
          Builders per week: max {building.maxBuilders}
        </div>
      )}
      {building.cost.wood > 0 && building.cost.labor > 0 && (
        <div className="small-text" data-testid="details-wood-per-builder">
          Wood per builder-week: {woodPerBuilderWeek(type).toFixed(1)}
        </div>
      )}
      <Section
        title="Storage"
        resources={building.storage ?? emptyResources}
        testId="details-storage"
      />
      <Section
        title="Produces per week"
        resources={building.produces}
        testId="details-produces"
      />
      <Section
        title="Consumes per week"
        resources={building.consumes}
        testId="details-consumes"
      />
    </article>
  );
};
