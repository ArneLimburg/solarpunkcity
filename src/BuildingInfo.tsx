import type { FC } from "react";
import type { HexCoordinates } from "./board";
import { formatEcology, nonZeroResources } from "./buildingDetails";
import { BuildingTypes, type Building } from "./gameDefinitions";
import type {
  BuildingReport,
  BuildingStatus,
  ConstructionReport,
} from "./game";
import type { Resources } from "./resources";
import type { Resident } from "./settlers";
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
  occupants: Resident[];
  construction: ConstructionReport | undefined; // construction sites only
  storedWood: number;
  fieldEfficiency: number; // percent
  onSelectResident: (id: number) => void;
  onClose: () => void;
}> = ({
  building,
  center,
  report,
  occupants,
  construction,
  storedWood,
  fieldEfficiency,
  onSelectResident,
  onClose,
}) => {
  return (
    <article className="hud-glass hud-panel" data-testid="building-info">
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
        <button
          className="circle transparent small"
          aria-label="Close building info"
          onClick={onClose}
        >
          <i aria-hidden="true">close</i>
        </button>
      </div>
      {construction && (
        <div data-testid="info-construction">
          <h6 className="no-margin small">Construction</h6>
          <div data-testid="info-progress">
            {construction.percent}% complete
          </div>
          <div data-testid="info-remaining-work">
            Remaining work: {construction.remainingWork} worker-weeks
          </div>
          <div data-testid="info-builders">
            Builders last week: {construction.builders} / {building.maxBuilders}
          </div>
          {construction.weeks === undefined ? (
            <div data-testid="info-waiting">Waiting for builders</div>
          ) : (
            <div data-testid="info-weeks">
              About {construction.weeks}{" "}
              {construction.weeks === 1 ? "week" : "weeks"} left
            </div>
          )}
        </div>
      )}
      {!construction && building.resident > 0 && (
        <div data-testid="info-residents">
          <h6 className="no-margin small">Residents</h6>
          <div data-testid="info-residents-count">
            {occupants.length} / {building.resident}
          </div>
          {occupants.length === 0 ? (
            <div data-testid="info-no-residents">No residents</div>
          ) : (
            <ul className="no-margin" data-testid="info-resident-list">
              {occupants.map(({ id, name }) => (
                <li key={id}>
                  <a
                    href="#"
                    data-testid={`info-resident-${id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onSelectResident(id);
                    }}
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!construction && building.storage && building.storage.wood > 0 && (
        <div data-testid="info-wood-stock">
          Wood stock {storedWood} / {building.storage.wood}
        </div>
      )}
      {!construction && building.produces.food > 0 && (
        <div data-testid="info-field-efficiency">
          Field efficiency {fieldEfficiency}%
        </div>
      )}
      {construction ? null : report ? (
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
