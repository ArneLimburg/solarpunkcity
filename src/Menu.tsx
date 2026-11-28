import type { FC } from "react";
import { chipClassName, unaffordableCosts } from "./buildingDetails";
import {
  BuildingCategories,
  BuildingDefinition,
  BuildingTypes,
  getLabel,
  type BuildingCategory,
  type BuildingType,
} from "./gameDefinitions";
import { resourceIcons } from "./resourceIcons";
import type { Resources } from "./resources";

// the Build button at the top left; it shows the selection while collapsed
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

// the list of buildings, one tab per buildable category
export const BuildList: FC<{
  category: BuildingCategory;
  selected: BuildingType | undefined;
  resources: Resources;
  onCategory: (category: BuildingCategory) => void;
  onSelect: (buildingType: BuildingType | undefined) => void;
}> = ({ category, selected, resources, onCategory, onSelect }) => (
  <section
    id="build-panel"
    className="hud-glass hud-panel"
    data-testid="build-panel"
    data-hud
  >
    <div className="row no-wrap" role="tablist">
      {buildableCategories.map(({ name, label }) => (
        <button
          key={name}
          role="tab"
          className={`border small ${category === name ? "fill" : ""}`}
          aria-selected={category === name}
          onClick={() => onCategory(name)}
        >
          {label}
        </button>
      ))}
    </div>
    <div className="hud-list" role="tabpanel">
      {(Object.keys(BuildingTypes) as BuildingType[])
        .filter((type) => BuildingTypes[type].category === category)
        .map((type) => {
          // the construction material: planks or wood
          const { wood, planks } = BuildingDefinition[type].cost;
          const material = planks > 0 ? "planks" : "wood";
          return (
            <button
              key={type}
              className={`border hud-row ${selected === type ? "fill" : ""}`}
              aria-label={getLabel(type)}
              aria-pressed={selected === type}
              onClick={() => onSelect(selected === type ? undefined : type)}
            >
              <img
                className="small"
                src={BuildingTypes[type].icon}
                alt=""
                aria-hidden="true"
              />
              <span className="max">{getLabel(type)}</span>
              <span
                className={chipClassName(
                  unaffordableCosts(type, resources).has(material),
                )}
                data-testid={`build-cost-${type}`}
              >
                <i aria-hidden="true">{resourceIcons[material]}</i>
                <span>{planks > 0 ? planks : wood}</span>
              </span>
            </button>
          );
        })}
    </div>
  </section>
);
