# cartoon-writers-room: how to run it

Everything runs from this folder. Your key lives only in `.env`, and IDs accumulate in `IDS.env`.

| Do this | Command |
|---|---|
| First launch (model → 📦 env → 🧠 memory → 🤖 agent → ▶️ session → 🎯 kickoff) | `./launch.sh` |
| Watch a run until it settles | `./poll.sh --wait` |
| Download the outputs (once idle) | `./fetch.sh` → `runs/<session>/week.md`, `scene-queue.json`, `channel-kit.md`, `memory-snapshot/` |
| Write another week right now | `./launch.sh run "writers room · extra batch"` |
| Regression check before changing the agent | copy `runs/<case-1>/memory-snapshot/*` → `evals/case-02/input/`, then `./evals/run-evals.sh` |
| Turn on the Sunday schedule (after a pass) | `./deploy.sh`, then `./deploy.sh run` to fire one now |

Each step skips objects already in `IDS.env`, so if anything fails, fix it and re-run the same command.

## Your weekly loop (from your PDF)
1. **Sunday 8:30 IST:** the deployment writes the week. Fetch `week.md` + `scene-queue.json` (Console → Sessions, or `./fetch.sh <session>`).
2. **Nightly:** paste each episode's 3 scene prompts into Wan2GP as jobs, all with the same seed, 8s, 720p.
3. **Morning:** stitch 3 clips into a 24s vertical Short, add narration + captions, and post with the title, description and hashtags from `week.md`.

Console: https://platform.claude.com/workspaces/default/agents. If your key is in another workspace, switch it with the workspace picker.

## Resuming in a new cloud session
The key comes from the environment variable `ANTHROPIC_API_KEY` (set in the cloud environment's settings); `lib.sh` falls back to it when `.env` is absent or empty. In the new session: `cd Freetin/cartoon-agent && ./launch.sh`, then `./poll.sh --wait` and `./fetch.sh`.
