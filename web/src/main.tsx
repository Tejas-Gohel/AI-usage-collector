import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ThemeProvider } from "./theme.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
