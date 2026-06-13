// Prints current skill/agent toolkit stats as JSON, straight from local transcripts.
// Deterministic (no Claude needed). Used by the daily AI-manager refresh and ad-hoc.
//   node --import tsx scripts/compute-stats.ts [projectFolder|all]
import { getDataset } from "../server/src/store.js";
import { buildToolkit } from "../server/src/toolkit.js";
import { readInventory } from "../server/src/inventory.js";

const project = process.argv[2] || "all";
const ds = await getDataset(project);
const inventory = project === "all" ? null : readInventory(ds.projectPaths.get(project) ?? "");
console.log(JSON.stringify(buildToolkit(ds, inventory), null, 2));
