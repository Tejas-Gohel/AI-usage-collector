import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ToolDef {
  name: string;
  description: string;
  version: string | null;
  scope: "project" | "user";
  source: string; // file path
}

export interface Inventory {
  skills: ToolDef[];
  agents: ToolDef[];
  commands: ToolDef[];
}

// Minimal YAML frontmatter reader (name / description / version only — no YAML dep needed).
function frontmatter(file: string): Record<string, string> {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf-8").slice(0, 4000);
  } catch {
    return {};
  }
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) out[kv[1].trim().toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function readSkills(root: string, scope: ToolDef["scope"]): ToolDef[] {
  const dir = path.join(root, "skills");
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  const out: ToolDef[] = [];
  for (const name of entries) {
    const file = path.join(dir, name, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const fm = frontmatter(file);
    out.push({
      name: fm.name || name,
      description: fm.description || "",
      version: fm.version || null,
      scope,
      source: file,
    });
  }
  return out;
}

function readMdDefs(root: string, sub: string, scope: ToolDef["scope"]): ToolDef[] {
  const dir = path.join(root, sub);
  const out: ToolDef[] = [];
  const walk = (d: string) => {
    let items: fs.Dirent[] = [];
    try {
      items = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of items) {
      const full = path.join(d, it.name);
      if (it.isDirectory()) walk(full);
      else if (it.name.endsWith(".md")) {
        const fm = frontmatter(full);
        out.push({
          name: fm.name || it.name.replace(/\.md$/, ""),
          description: fm.description || "",
          version: fm.version || null,
          scope,
          source: full,
        });
      }
    }
  };
  walk(dir);
  return out;
}

// Dedup by name, project scope wins over user scope.
function merge(a: ToolDef[], b: ToolDef[]): ToolDef[] {
  const map = new Map<string, ToolDef>();
  for (const d of [...b, ...a]) map.set(d.name, d); // a (project) added last → wins
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
}

export function readInventory(projectPath: string): Inventory {
  const userRoot = path.join(os.homedir(), ".claude");
  const projRoot = path.join(projectPath, ".claude");

  return {
    skills: merge(readSkills(projRoot, "project"), readSkills(userRoot, "user")),
    agents: merge(readMdDefs(projRoot, "agents", "project"), readMdDefs(userRoot, "agents", "user")),
    commands: merge(readMdDefs(projRoot, "commands", "project"), readMdDefs(userRoot, "commands", "user")),
  };
}
