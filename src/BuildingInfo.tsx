import type { FC } from "react";
import type { HexCoordinates } from "./board";
import { formatEcology, nonZeroResources } from "./buildingDetails";
import { getResidents } from "./buildingInfo";
import { BuildingTypes, type Building } from "./gameDefinitions";
import type { BuildingReport, BuildingStatus } from "./game";
import type { Resources } from "./resources";
import { resourceIcons } from "./resourceIcons";

const statusTexts: Record<BuildingStatus, string> = {
  "not-needed": "Not needed",
  "no-workers": "No workers available",
  "missing-resources": "Not enough resources",
};

const Section: FC<{ title: string; resources: Resources; testId: string }> = ({
  title,
  resources,
  testId,
}) => {
  const entries = nonZeroResources(resources);
  if (entries.length === 0) return null;
  return (
    <div data-testid={testId}>
      <div className="small-text">{title}</div>
      <div className="row wrap">
        {entries.map(([name, value]) => (
          <span
            key={name}
            className="chip no-margin"
            title={name}
            aria-label={name}
            data-testid={`info-${name}`}
          >
            <i>{resourceIcons[name]}</i>
            <span>{String(value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export const BuildingInfo: FC<{
  building: Building;
  center: HexCoordinates;
  report: BuildingReport | undefined;
  population: number;
  housing: number;
}> = ({ building, center, report, population, housing }) => {
  const residents = getResidents(building.resident, population, housing);
  return (
    <article
      className="small-opacity padding"
      data-testid="building-info"
      style={{
        margin: "0 0 0 1rem",
        maxWidth: "20rem",
        alignSelf: "flex-start",
        pointerEvents: "auto",
      }}
    >
      <div className="row no-wrap">
        <img
          className="small"
          src={BuildingTypes[building.type].icon}
          alt=""
          aria-hidden="true"
        />
        <div className="max">
          <h6 className="no-margin">{building.name}</h6>
          <div className="small-text" data-testid="info-center">
            {center.q}, {center.r}
          </div>
        </div>
        <span className="chip no-margin" data-testid="info-ecology">
          <i>eco</i>
          <span>
            {/* rounded against floating point noise such as 1.4000000000000001 */}
            {formatEcology(
              Math.round(building.ecology * building.size * 100) / 100,
            )}
          </span>
        </span>
      </div>
      {building.resident > 0 && (
        <div data-testid="info-residents">
          Residents {residents.residents} / {building.resident} (
          {residents.percent} %)
        </div>
      )}
      {report ? (
        <div data-testid="info-last-week">
          <h6 className="no-margin small">Last week</h6>
          {building.consumes.labor > 0 && (
            <div data-testid="info-workers">
              Workers {report.workers} / {building.consumes.labor}
            </div>
          )}
          <Section
            title="Produced"
            resources={report.produced}
            testId="info-produced"
          />
          <Section
            title="Consumed"
            resources={report.consumed}
            testId="info-consumed"
          />
          {report.status && (
            <div data-testid="info-status">{statusTexts[report.status]}</div>
          )}
        </div>
      ) : (
        <div data-testid="info-no-data">No data yet</div>
      )}
    </article>
  );
};
