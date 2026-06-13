import os from "node:os";
import path from "node:path";

export const PROJECTS_ROOT =
  process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), ".claude", "projects");

// Claude Code encodes a cwd into a folder name by replacing path separators and ':' with '-'.
// That transform is lossy (can't tell a '-' from a separator), so this is a readable best effort,
// not a round-trip. Good enough for display; we never write back to these paths.
export function decodeProjectFolder(folder: string): string {
  // Leading drive letter like "T--Projects..." -> "T:\Projects\..."
  const m = folder.match(/^([A-Za-z])--(.*)$/);
  if (m) return `${m[1]}:\\` + m[2].replace(/-/g, "\\");
  return folder.replace(/-/g, "/");
}

// Short, friendly label: last path segment.
export function projectLabel(folder: string): string {
  const decoded = decodeProjectFolder(folder);
  const parts = decoded.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || folder;
}
