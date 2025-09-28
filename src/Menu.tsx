import { useState, type FC } from "react";
import {
  BuildingCategories,
  BuildingTypes,
  type BuildingCategory,
  type BuildingType,
} from "./game";

export const Menu: FC<{
  selected: BuildingType | undefined;
  onSelect: (buildingType: BuildingType) => void;
}> = ({ selected, onSelect }) => {
  const [open, setOpen] = useState<BuildingCategory | undefined>();
  return (
    <header className="transparent">
      <nav className="top transparent">
        <div className="max"></div>
        {Object.values(BuildingCategories).map(
          (category) =>
            category.buildable && (
              <div key={category.name} className="details">
                <button
                  className={`border button extra circle ${selected && BuildingTypes[selected].category === category.name ? "large-elevate" : "small-elevate"}`}
                  onClick={() => setOpen(category.name)}
                >
                  <img className="responsive" src={category.icon} />
                </button>
                {open === category.name && (
                  <nav className="list">
                    {Object.entries(BuildingTypes)
                      .filter(
                        ([, details]) => details.category === category.name,
                      )
                      .map(([type, details]) => (
                        <button
                          key={type}
                          className={`border button extra circle ${selected && BuildingTypes[selected].category === category.name ? "large-elevate" : "small-elevate"}`}
                          onClick={() => {
                            setOpen(undefined);
                            onSelect(type as BuildingType);
                          }}
                        >
                          <img className="responsive" src={details.icon} />
                        </button>
                      ))}
                  </nav>
                )}
              </div>
            ),
        )}
      </nav>
    </header>
  );
};
