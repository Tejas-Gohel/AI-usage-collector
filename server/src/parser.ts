import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { costOf } from "./pricing.js";
import { decodeProjectFolder } from "./paths.js";
import type { ParsedProject, MessageEvent } from "./types.js";

function dateParts(iso: string | undefined): { ts: number; dateKey: string; hour: number; weekday: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return null;
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  return { ts, dateKey, hour: d.getHours(), weekday: d.getDay() };
}

// Parse a single project folder's JSONL files into typed events.
// Dedup assistant records by `${message.id}:${requestId}` — Claude Code re-logs messages on
// session resume, and cache_read tokens repeat, so naive summing double-counts spend.
export async function parseFolder(rootDir: string, folder: string): Promise<ParsedProject> {
  const dir = path.join(rootDir, folder);
  const cwd = decodeProjectFolder(folder);
  const out: ParsedProject = {
    events: [],
    prompts: [],
    toolResults: [],
    skills: [],
    agents: [],
    sessions: new Map(),
  };
  const seen = new Set<string>(); // msg.id:requestId — counts usage/cost once per message
  const seenTool = new Set<string>(); // tool_use.id — counts each tool call once across re-logs
  const msgMap = new Map<string, MessageEvent>(); // one merged event per message

  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return out;
  }

  for (const file of files) {
    const full = path.join(dir, file);
    const sessionFallback = file.replace(/\.jsonl$/, "");
    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let r: any;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const type = r.type;
      const sessionId = r.sessionId || sessionFallback;

      const meta = out.sessions.get(sessionId) ?? {
        sessionId,
        project: folder,
        cwd,
        title: null,
        branch: null,
      };

      if (type === "ai-title" && r.aiTitle) {
        meta.title = r.aiTitle;
        out.sessions.set(sessionId, meta);
        continue;
      }

      if (type === "assistant") {
        const msg = r.message ?? {};
        const content = Array.isArray(msg.content) ? msg.content : [];
        const dp = dateParts(r.timestamp);
        const ts = dp?.ts ?? 0;
        // A single message can be split across records (thinking / text / tool_use) sharing this key.
        const key = msg.id ? `${msg.id}:${r.requestId ?? "?"}` : r.uuid ?? `${file}:${out.events.length}`;
        const usage = msg.usage;

        // Cost/usage: create the merged event once per message, only if usage is present.
        if (usage && !seen.has(key)) {
          seen.add(key);
          const cc = usage.cache_creation ?? {};
          const tokens = {
            input: usage.input_tokens ?? 0,
            output: usage.output_tokens ?? 0,
            cacheRead: usage.cache_read_input_tokens ?? 0,
            cacheCreate5m: cc.ephemeral_5m_input_tokens ?? 0,
            cacheCreate1h: cc.ephemeral_1h_input_tokens ?? 0,
          };
          const model = msg.model ?? "unknown";
          if (r.gitBranch) meta.branch = r.gitBranch;
          out.sessions.set(sessionId, meta);
          msgMap.set(key, {
            sessionId,
            project: folder,
            cwd: r.cwd || cwd,
            model,
            gitBranch: r.gitBranch ?? null,
            ts,
            dateKey: dp?.dateKey ?? "unknown",
            hour: dp?.hour ?? 0,
            weekday: dp?.weekday ?? 0,
            tokens,
            cost: costOf(model, tokens),
            hasThinking: false,
            tools: [],
          });
        }

        // Content: merge across all records of the message; dedup each tool call by its id.
        const ev = msgMap.get(key);
        for (const c of content) {
          if (c?.type === "thinking" && c.thinking && ev) ev.hasThinking = true;
          if (c?.type !== "tool_use") continue;
          const tid = c.id;
          if (tid && seenTool.has(tid)) continue;
          if (tid) seenTool.add(tid);
          if (ev) ev.tools.push(c.name);
          if (c.name === "Skill" && c.input?.skill) {
            out.skills.push({ sessionId, project: folder, ts, skill: String(c.input.skill) });
          } else if ((c.name === "Agent" || c.name === "Task") && c.input) {
            const agent = c.input.subagent_type || c.input.description || "unknown";
            out.agents.push({ sessionId, project: folder, ts, agent: String(agent) });
          }
        }
        continue;
      }

      if (type === "user") {
        const msg = r.message ?? {};
        const content = msg.content;
        if (typeof content === "string") {
          // a real typed/queued prompt
          const dp = dateParts(r.timestamp);
          out.prompts.push({
            sessionId,
            project: folder,
            ts: dp?.ts ?? 0,
            chars: content.length,
            source: r.promptSource ?? "unknown",
            text: content.slice(0, 280),
          });
          if (r.gitBranch) meta.branch = r.gitBranch;
          out.sessions.set(sessionId, meta);
        } else if (Array.isArray(content)) {
          for (const item of content) {
            if (item?.type === "tool_result") {
              out.toolResults.push({
                sessionId,
                project: folder,
                isError: item.is_error === true,
              });
            }
          }
        }
        continue;
      }
    }
  }

  out.events = [...msgMap.values()];
  return out;
}
