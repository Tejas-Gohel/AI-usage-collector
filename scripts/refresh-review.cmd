@echo off
REM Daily AI-Manager review refresh. Runs headless Claude Code in this repo,
REM regenerating ai-manager-review.json from local usage + current market docs.
REM Portable: derives the repo root and uses `claude` from PATH.
cd /d "%~dp0.."
type "scripts\refresh-review-prompt.txt" | claude -p --permission-mode acceptEdits --allowedTools "Bash" "Read" "Write" "Edit" "WebSearch" >> "scripts\last-refresh.log" 2>&1
