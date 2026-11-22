import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useStore } from "./store";
import "./index.css";

// Dev/demo: expõe o store para o browser tooling injetar dados (?demo=1).
// Nunca entra em build de produção — é guard por URL, em main.tsx dev-only.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
  (window as any).__zstore = useStore;
}
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Dev/demo: auto-seed após o primeiro render (?demo=1&seed=1).
if (import.meta.env.DEV && new URLSearchParams(location.search).get("seed") === "1") {
  setTimeout(async () => {
    try {
      const mod = await import("./demo-seed");
      mod.default ? mod.default() : (window as any).__zstore && null;
    } catch (e) {
      console.error("seed failed", e);
    }
  }, 300);
}
