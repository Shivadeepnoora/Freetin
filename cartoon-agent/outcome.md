# Definition of done: a writers' room run

Grade each check pass/fail. All six must pass.

1. **Series bible exists in the memory store** (series-bible.md) with: a character name, a 3-line personality, 2 recurring friends, 3 recurring locations, and a one-line style string describing body shape, fur/skin, eyes, lighting and camera. On later runs, the main character and the style string are unchanged from the existing bible.
2. **Exactly 5 new episodes** in /mnt/session/outputs/week.md, each with a title of at most 5 words, a 2-line story, and 3 scene prompts, ending on a warm moment rather than a cliffhanger.
3. **Every one of the 15 scene prompts is Wan2GP-ready**: it starts with the exact style string, contains one clear action, ends with a camera move, is under 45 words, and requests no on-screen text. scene-queue.json is valid JSON containing the same 15 prompts.
4. **Each episode has a complete YouTube package**: a title under 40 characters that starts with the character's name and is not clickbait, a 2-line description, exactly 5 hashtags, and a narration script of at most 2 sentences.
5. **No repeats**: no episode premise duplicates one already in episode-log.md from earlier runs, and this run's 5 episodes have been appended to episode-log.md (and to memory-snapshot/episode-log.md).
6. **Family-friendly and original**: nothing scary, violent or unsafe to imitate; no branded, trademarked or third-party characters; the tone has a gentle wink adults would enjoy; nothing is labelled "made for kids".
