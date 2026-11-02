import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import Proto3DPage from "./proto3d/Proto3DPage";
import Game3DPage from "./three3d/Game3DPage";

// Routes:
//   (default)  -> 2D game (unchanged fallback and regression reference)
//   ?proto3d   -> Phase 6A/7 isolated 3D slice (kept until replaced)
//   ?game3d    -> Phase 9.1 reusable 3D application shell
// The 2D game stays the default until ?game3d meets its Phase 9 criteria.
const params = new URLSearchParams(window.location.search);
const showProto3d = params.has("proto3d");
const showGame3d = params.has("game3d");

function resolveRoute() {
  if (showGame3d) return <Game3DPage />;
  if (showProto3d) return <Proto3DPage />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {resolveRoute()}
  </StrictMode>
);
