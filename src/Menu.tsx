import { useEffect, useState, type FC } from "react";
import {
  BuildingCategories,
  BuildingTypes,
  type BuildingCategory,
  type BuildingType,
} from "./gameDefinitions";

export const Menu: FC<{
  selected: BuildingType | undefined;
  onSelect: (buildingType: BuildingType | undefined) => void;
}> = ({ selected, onSelect }) => {
  const [open, setOpen] = useState<BuildingCategory | undefined>();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(undefined);
        onSelect(undefined);
      }
    };
    // does not stop the event, so the map still handles it
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest("header")
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
  }, [onSelect]);
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
                  aria-label={category.name}
                  aria-expanded={open === category.name}
                  onClick={() =>
                    setOpen(open === category.name ? undefined : category.name)
                  }
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
                          className={`border button extra circle ${selected === type ? "large-elevate" : "small-elevate"}`}
                          aria-label={type}
                          aria-pressed={selected === type}
                          onClick={() => {
                            setOpen(undefined);
                            onSelect(
                              selected === type
                                ? undefined
                                : (type as BuildingType),
                            );
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
