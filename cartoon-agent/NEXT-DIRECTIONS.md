# Next directions: cartoon-writers-room

v0 (live): the writers' room. It creates the series bible once, then writes 5 episodes every Sunday (Wan2GP scene prompts, narration, YouTube package), with a 🧠 memory store keeping the character consistent and stories fresh.

## v1 · 📊 Weekly review shapes the next batch
- **What:** before writing, the agent reads last week's performance (views, average watch time per Short) and leans the new batch toward the episode types that held attention (your PDF's "make 3 more like it").
- **Why not in v0:** a later version. There's no data until a couple of weeks of posts exist. Pulling it automatically needs YouTube Analytics access (needs a credential).
- **How:** step 1: paste the numbers into the memory store as `/performance.md` (`POST /v1/memory_stores/$MEMSTORE_ID/memories`) and add one line to `first_prompt.txt`: "If performance.md exists, use it to choose this week's mix and say why in week.md". This needs no agent version bump. Step 2: YouTube Analytics API with an OAuth token in a 🔐 vault (`environment_variable` credential, `allowed_hosts: ["youtubeanalytics.googleapis.com"]`).

## v2 · 🎙️ Voiceover audio per episode
- **Why not in v0:** needs an ElevenLabs API key.
- **How:** 🔐 vault credential `{"auth":{"type":"environment_variable","secret_name":"ELEVENLABS_API_KEY","secret_value":"…","networking":{"type":"limited","allowed_hosts":["api.elevenlabs.io"]}}}`. Pass `vault_ids` on the session/deployment and add to the system prompt: "generate narration-epNN.mp3 with the ElevenLabs TTS API". Docs: platform.claude.com/docs/en/managed-agents/vaults

## v3 · 🎞️ Clip rendering
- **Why not in v0:** not possible inside the agent. Wan2GP needs an NVIDIA GPU, and the CMA sandbox is CPU-only. Until then, rendering stays on your PC, fed from `scene-queue.json`.
- **How:** pick a hosted video-generation API or a rented GPU endpoint running Wan (e.g. a RunPod serverless endpoint). Its key goes in a 🔐 vault as an `environment_variable` credential, host-limited, and the agent submits the 15 prompts from `scene-queue.json` and downloads the clips to `/mnt/session/outputs/clips/`.

## v4 · ✂️ Auto-assemble each 24-second Short
- **Why not in v0:** a later version. It needs clips first (from v3, or uploaded via the Files API).
- **How:** add `"packages": {"apt": ["ffmpeg"]}` to the 📦 environment; the agent stitches 3 clips to 9:16, lays in a royalty-free track you supply and burns big friendly captions from the narration.

## v5 · 📺 Upload to YouTube as private/unlisted
- **Why not in v0:** a public action, and it needs YouTube OAuth (needs a credential). It waits until you trust the output.
- **How:** YouTube Data API token in a 🔐 vault; upload as `privacyStatus: private` with title, description and hashtags from `week.md`. Gate it with a custom `upload_short` tool or `always_ask` on bash, so every upload waits for your approval.

## Also on the list
- **Day-21 compilation:** a monthly run that strings 10 logged episodes into a 10-minute "best of" script and package (your PDF's bigger-money format). Same agent, a different kickoff.
- **Path 2 (motion graphics):** a separate agent once you have the toolkit files.
- **Always:** re-run `evals/run-evals.sh` before promoting any new agent version to the deployment. Only update the deployment's pinned version when case-02 still passes.
