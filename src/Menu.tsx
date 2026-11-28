import type { FC } from "react";
import { chipClassName, unaffordableCosts } from "./buildingDetails";
import {
  BuildingCategories,
  BuildingDefinition,
  BuildingTypes,
  getLabel,
  isInBuildMenu,
  type BuildingCategory,
  type BuildingType,
} from "./gameDefinitions";
import { resourceIcons } from "./resourceIcons";
import { getLockReason, type Resource } from "./achievements";
import type { Resources } from "./resources";

// the Cancel placement button, it clears the blueprint
export const CancelButton: FC<{ desktop: boolean; onCancel: () => void }> = ({
  desktop,
  onCancel,
}) => (
  <button className="border hud-glass hud-cancel" data-hud onClick={onCancel}>
    <i aria-hidden="true">close</i>
    <span>{desktop ? "Cancel placement" : "✕ Cancel placement"}</span>
  </button>
);

// the Build button at the top left (phones); it shows the selection while collapsed
export const BuildButton: FC<{
  open: boolean;
  selected: BuildingType | undefined;
  onToggle: () => void;
}> = ({ open, selected, onToggle }) => (
  <button
    className="border hud-glass hud-build"
    aria-expanded={open}
    aria-controls="build-panel"
    data-hud
    onClick={onToggle}
  >
    <i aria-hidden="true">construction</i>
    <span>{!open && selected ? `Build: ${getLabel(selected)}` : "Build"}</span>
  </button>
);

const buildableCategories = Object.values(BuildingCategories).filter(
  (category) => category.buildable,
);

// the buildings of one category
const BuildingRows: FC<{
  category: BuildingCategory;
  selected: BuildingType | undefined;
  resources: Resources;
  achieved: Resource[];
  onSelect: (buildingType: BuildingType | undefined) => void;
}> = ({ category, selected, resources, achieved, onSelect }) => (
  <div className="hud-list">
    {(Object.keys(BuildingTypes) as BuildingType[])
      .filter(
        (type) =>
          BuildingTypes[type].category === category && isInBuildMenu(type),
      )
      .map((type) => {
        // the construction material: planks or wood
        const { wood, planks } = BuildingDefinition[type].cost;
        const material = planks > 0 ? "planks" : "wood";
        const lockReason = getLockReason(type, new Set(achieved));
        return (
          <button
            key={type}
            className={`border hud-row ${selected === type ? "fill" : ""}`}
            aria-label={getLabel(type)}
            aria-pressed={selected === type}
            aria-disabled={lockReason !== undefined}
            data-locked={lockReason !== undefined}
            onClick={() => {
              if (lockReason === undefined) {
                onSelect(selected === type ? undefined : type);
              }
            }}
          >
            <img
              className="small"
              src={BuildingTypes[type].icon}
              alt=""
              aria-hidden="true"
            />
            <span className="max">{getLabel(type)}</span>
            {lockReason === undefined ? (
              <span
                className={chipClassName(
                  unaffordableCosts(type, resources).has(material),
                )}
                data-testid={`build-cost-${type}`}
              >
                <i aria-hidden="true">{resourceIcons[material]}</i>
                <span>{planks > 0 ? planks : wood}</span>
              </span>
            ) : (
              <>
                <i aria-hidden="true" data-testid={`build-lock-${type}`}>
                  lock
                </i>
                <div
                  className="tooltip"
                  role="tooltip"
                  data-testid={`build-lock-reason-${type}`}
                >
                  {lockReason}
                </div>
              </>
            )}
          </button>
        );
      })}
  </div>
);

type MenuProps = {
  // the category whose buildings are shown
  category: BuildingCategory | undefined;
  selected: BuildingType | undefined;
  resources: Resources;
  achieved: Resource[];
  onCategory: (category: BuildingCategory | undefined) => void;
  onSelect: (buildingType: BuildingType | undefined) => void;
};

// desktop: the bar at the bottom edge with one button per category; the buildings of the open
// category are listed above its button
export const BuildBar: FC<MenuProps & { onCancel: () => void }> = ({
  category,
  selected,
  resources,
  achieved,
  onCategory,
  onSelect,
  onCancel,
}) => (
  <div className="hud-bottom">
    <nav className="hud-bar hud-glass" data-testid="build-bar" data-hud>
      {buildableCategories.map(({ name, label, icon }) => (
        <div key={name} className="hud-bar-item">
          <button
            className={`border hud-category ${category === name ? "fill" : ""}`}
            aria-expanded={category === name}
            aria-controls="build-panel"
            onClick={() => onCategory(category === name ? undefined : name)}
          >
            <img className="small" src={icon} alt="" aria-hidden="true" />
            <span>{label}</span>
          </button>
          {category === name && (
            <section
              id="build-panel"
              className="hud-glass hud-panel hud-bar-list"
              data-testid="build-panel"
              data-hud
            >
              <BuildingRows
                category={name}
                selected={selected}
                resources={resources}
                achieved={achieved}
                onSelect={onSelect}
              />
            </section>
          )}
        </div>
      ))}
      {selected && <CancelButton desktop onCancel={onCancel} />}
    </nav>
  </div>
);

// phones: the list of categories, the open one shows its buildings (accordion)
export const BuildMenu: FC<MenuProps> = ({
  category,
  selected,
  resources,
  achieved,
  onCategory,
  onSelect,
}) => (
  <section
    id="build-panel"
    className="hud-glass hud-panel"
    data-testid="build-panel"
    data-hud
  >
    {buildableCategories.map(({ name, label, icon }) => (
      <div key={name}>
        <button
          className={`border hud-row ${category === name ? "fill" : ""}`}
          aria-expanded={category === name}
          onClick={() => onCategory(category === name ? undefined : name)}
        >
          <img className="small" src={icon} alt="" aria-hidden="true" />
          <span className="max">{label}</span>
        </button>
        {category === name && (
          <BuildingRows
            category={name}
            selected={selected}
            resources={resources}
            achieved={achieved}
            onSelect={onSelect}
          />
        )}
      </div>
    ))}
  </section>
);
