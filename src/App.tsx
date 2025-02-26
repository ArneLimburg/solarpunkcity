import { type FC } from "react";
import { Map } from "./Map";

export const App: FC = () => {
  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}>
      <Map onSelected={() => {}} />
    </div>
  );
};
