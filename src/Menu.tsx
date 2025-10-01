import { useState, type FC } from "react";

export const Menu: FC<{
  selectedIcon: number;
  onSelect: (icon: number) => void;
}> = ({ selectedIcon, onSelect }) => {
  const [open, setOpen] = useState(0);
  return (
    <header className="transparent">
      <nav className="top transparent">
        <div className="max"></div>
        <div className="details">
          <button
            className={`border button extra circle ${selectedIcon !== 1 ? "large-elevate" : "small-elevate"}`}
            onClick={() => setOpen(1)}
          >
            <img className="responsive" src="farm/farm-icon.png" />
          </button>
          {open === 1 && (
            <nav className="list">
              <a
                className="item"
                onClick={() => {
                  setOpen(0);
                  onSelect(1);
                }}
              >
                Home
              </a>
              <a
                className="item"
                onClick={() => {
                  setOpen(0);
                  onSelect(1);
                }}
              >
                Über uns
              </a>
              <a
                className="item"
                onClick={() => {
                  setOpen(0);
                  onSelect(1);
                }}
              >
                Kontakt
              </a>
            </nav>
          )}
        </div>
        <div className="details">
          <button
            className={`border button extra circle ${selectedIcon !== 2 ? "large-elevate" : "small-elevate"}`}
            onClick={() => setOpen(2)}
          >
            <img
              className="responsive"
              src="residential/residential-icon.png"
            />
          </button>
          {open === 2 && (
            <nav className="list">
              <a
                className="item"
                onClick={() => {
                  setOpen(0);
                  onSelect(2);
                }}
              >
                Home
              </a>
              <a
                className="item"
                onClick={() => {
                  setOpen(0);
                  onSelect(2);
                }}
              >
                Über uns
              </a>
              <a
                className="item"
                onClick={() => {
                  setOpen(0);
                  onSelect(2);
                }}
              >
                Kontakt
              </a>
            </nav>
          )}
        </div>
      </nav>
    </header>
  );
};
