import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// StrictMode is intentionally not used: the WebGL engine owns a long-lived renderer.
createRoot(document.getElementById("root")!).render(<App />);
