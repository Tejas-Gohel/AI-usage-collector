import fs from "node:fs";
import path from "node:path";
import { PROJECTS_ROOT, projectLabel, decodeProjectFolder } from "./paths.js";
import { parseFolder } from "./parser.js";
import type { ParsedProject } from "./types.js";
import type { Dataset } from "./metrics.js";

interface CacheEntry {
  parsed: ParsedProject;
  signature: string; // mtimes+sizes of jsonl files, to detect changes
}

const cache = new Map<string, CacheEntry>();

function folderSignature(dir: string): string {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    return files
      .map((f) => {
        const s = fs.statSync(path.join(dir, f));
        return `${f}:${s.mtimeMs}:${s.size}`;
      })
      .sort()
      .join("|");
  } catch {
    return "";
  }
}

export function listProjectFolders(): string[] {
  try {
    return fs
      .readdirSync(PROJECTS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

async function getProject(folder: string): Promise<ParsedProject> {
  const dir = path.join(PROJECTS_ROOT, folder);
  const sig = folderSignature(dir);
  const hit = cache.get(folder);
  if (hit && hit.signature === sig) return hit.parsed;
  const parsed = await parseFolder(PROJECTS_ROOT, folder);
  cache.set(folder, { parsed, signature: sig });
  return parsed;
}

// Build a Dataset for either a single project folder or "all".
export async function getDataset(project: string | "all"): Promise<Dataset> {
  const folders = project === "all" ? listProjectFolders() : [project];
  const parsedList = await Promise.all(folders.map(getProject));

  const ds: Dataset = {
    events: [],
    prompts: [],
    toolResults: [],
    skills: [],
    agents: [],
    sessionTitles: new Map(),
    sessionBranch: new Map(),
    projectLabels: new Map(),
    projectPaths: new Map(),
  };
  for (const folder of folders) {
    ds.projectLabels.set(folder, projectLabel(folder));
    ds.projectPaths.set(folder, decodeProjectFolder(folder));
  }

  for (const p of parsedList) {
    ds.events.push(...p.events);
    ds.prompts.push(...p.prompts);
    ds.toolResults.push(...p.toolResults);
    ds.skills.push(...p.skills);
    ds.agents.push(...p.agents);
    // Prefer the real cwd recorded in a transcript over the lossy folder-name decode.
    const realCwd = p.events.find((e) => e.cwd)?.cwd;
    if (realCwd) ds.projectPaths.set(p.events[0]?.project ?? "", realCwd);
    for (const [id, meta] of p.sessions) {
      ds.sessionTitles.set(id, meta.title);
      ds.sessionBranch.set(id, meta.branch);
    }
  }
  return ds;
}

export function invalidate() {
  cache.clear();
}

export async function projectIndex() {
  const folders = listProjectFolders();
  const parsedList = await Promise.all(folders.map(getProject));
  return folders
    .map((folder, i) => {
      const p = parsedList[i];
      const cost = p.events.reduce((s, e) => s + e.cost, 0);
      const sessions = new Set(p.events.map((e) => e.sessionId)).size;
      return {
        project: folder,
        label: projectLabel(folder),
        cost: Math.round(cost * 100) / 100,
        sessions,
        msgs: p.events.length,
      };
    })
    .filter((p) => p.msgs > 0)
    .sort((a, b) => b.cost - a.cost);
}
