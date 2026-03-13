import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./App";
import "./index.css";

// Einstiegspunkt der React-Anwendung.
// In Vite wird diese Datei von index.html referenziert.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
);

