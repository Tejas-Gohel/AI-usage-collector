import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDataset, projectIndex, invalidate } from "./store.js";
import { buildOverview, buildSessions } from "./metrics.js";
import { buildToolkit } from "./toolkit.js";
import { readInventory } from "./inventory.js";
import { getConfig, getReview } from "./config.js";
import { PROJECTS_ROOT } from "./paths.js";

const app = express();
const PORT = Number(process.env.PORT) || 5174;
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, projectsRoot: PROJECTS_ROOT });
});

// List of projects for the global ⇄ per-project switcher.
app.get("/api/projects", async (_req, res, next) => {
  try {
    res.json(await projectIndex());
  } catch (e) {
    next(e);
  }
});

// Full aggregate overview. ?project=all | <folder>
app.get("/api/overview", async (req, res, next) => {
  try {
    const project = (req.query.project as string) || "all";
    const ds = await getDataset(project);
    res.json(buildOverview(ds));
  } catch (e) {
    next(e);
  }
});

// Session list for the explorer. ?project=all | <folder>
app.get("/api/sessions", async (req, res, next) => {
  try {
    const project = (req.query.project as string) || "all";
    const ds = await getDataset(project);
    res.json(buildSessions(ds));
  } catch (e) {
    next(e);
  }
});

// Skills + agents inventory joined with usage and rework scoring. ?project=all | <folder>
// Disk inventory is only read for a specific project (paths are project-scoped).
app.get("/api/toolkit", async (req, res, next) => {
  try {
    const project = (req.query.project as string) || "all";
    const ds = await getDataset(project);
    const inventory = project === "all" ? null : readInventory(ds.projectPaths.get(project) ?? "");
    res.json(buildToolkit(ds, inventory));
  } catch (e) {
    next(e);
  }
});

// Identity / subscription card.
app.get("/api/me", (_req, res) => {
  res.json(getConfig());
});

// AI Manager review (generated out-of-band, rendered here with a staleness flag).
app.get("/api/review", (_req, res) => {
  res.json(getReview());
});

// Force a re-scan (clears the mtime cache).
app.post("/api/refresh", (_req, res) => {
  invalidate();
  res.json({ ok: true });
});

// Serve the built SPA (production / background-service mode). When `dist/` exists, this
// single process serves both the API and the frontend, so no Vite dev server is needed.
const hasBuild = fs.existsSync(path.join(DIST, "index.html"));
if (hasBuild) {
  app.use(express.static(DIST));
  // SPA fallback for any non-API, non-asset route (Express 5: use middleware, not "*").
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST, "index.html"));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: String(err?.message ?? err) });
});

app.listen(PORT, () => {
  console.log(`usage-collector on http://localhost:${PORT}`);
  console.log(hasBuild ? `serving built UI from ${DIST}` : "API only (no dist build found — run `npm run build`)");
  console.log(`reading transcripts from ${PROJECTS_ROOT}`);
});
