import type { FC } from "react";
import {
  formatEcology,
  formatTiles,
  nonZeroResources,
  unaffordableCosts,
} from "./buildingDetails";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import type { Resources } from "./resources";
import { resourceIcons } from "./resourceIcons";

const Chip: FC<{
  name: string;
  icon: string;
  value: string;
  error?: boolean;
}> = ({ name, icon, value, error }) => (
  <span
    className={error ? "chip no-margin error" : "chip no-margin"}
    title={name}
    aria-label={name}
    data-testid={`detail-${name}`}
  >
    <i>{icon}</i>
    <span>{value}</span>
  </span>
);

const Section: FC<{
  title: string;
  resources: Resources;
  testId: string;
  errors?: Set<keyof Resources>;
}> = ({ title, resources, testId, errors }) => {
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
            value={String(value)}
            error={errors?.has(name)}
          />
        ))}
      </div>
    </div>
  );
};

export const BuildingDetails: FC<{
  type: BuildingType;
  resources: Resources;
}> = ({ type, resources }) => {
  const building = BuildingDefinition[type];
  return (
    <article
      className="small-opacity"
      data-testid="building-details"
      style={{
        position: "fixed",
        left: "1rem",
        bottom: "4.5rem",
        margin: 0,
        maxWidth: "20rem",
        zIndex: 10,
      }}
    >
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
