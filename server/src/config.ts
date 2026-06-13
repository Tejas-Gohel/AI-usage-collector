import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_FILE = path.join(ROOT, "usage-collector.config.json");
const REVIEW_FILE = path.join(ROOT, "ai-manager-review.json");

export interface AppConfig {
  name: string;
  email: string;
  plan: string;
  planPriceUsd: number;
}

const DEFAULT: AppConfig = {
  name: process.env.USERNAME || process.env.USER || "You",
  email: "",
  plan: "Claude (subscription)",
  planPriceUsd: 100,
};

export function getConfig(): AppConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return { ...DEFAULT, ...raw };
  } catch {
    // seed a default file so the user has something editable
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT, null, 2));
    } catch {
      /* read-only fs — ignore */
    }
    return DEFAULT;
  }
}

// The AI Manager review is produced out-of-band (by Claude Code, e.g. on a daily schedule)
// and dropped here as JSON. The server just reads it and reports how stale it is.
export function getReview(): { review: any | null; ageDays: number | null; stale: boolean; generatedAt: string | null } {
  try {
    const review = JSON.parse(fs.readFileSync(REVIEW_FILE, "utf-8"));
    const gen = review.generatedAt ? new Date(review.generatedAt).getTime() : null;
    const ageDays = gen ? (Date.now() - gen) / 86_400_000 : null;
    return { review, ageDays, stale: ageDays !== null && ageDays > 1, generatedAt: review.generatedAt ?? null };
  } catch {
    return { review: null, ageDays: null, stale: true, generatedAt: null };
  }
}
