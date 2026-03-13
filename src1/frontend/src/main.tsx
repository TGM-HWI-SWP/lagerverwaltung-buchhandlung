import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Einstiegspunkt der React-Anwendung.
// In Vite wird diese Datei von index.html referenziert.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

