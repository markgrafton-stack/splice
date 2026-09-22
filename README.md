# Splice

Internal FST tool: paste in the films, ads and edits that capture a client's look, catalogue them on a shared board per project, and cut a GIF montage of the collection to send along or drop into a deck.

Sibling tool to [chop-shop](../chop-shop) — same brand, opposite end of a project: chop-shop cuts the content you're shipping, Splice collects the references you're pitching from.

## What it does

Two stages: collect and rate everything first, then pick which ones become the montage.

- **Collect** — paste a YouTube or Vimeo link. The app resolves the title/thumbnail/duration and embeds the actual player right on the card, so you can watch the full video. Nothing is downloaded at this point.
- **Rate** — 👍/👎 each one as you go, just to flag which references are actually worth using. Rated-up entries float to the top of the board to make the next step easier.
- **Select** — tick "Add to montage" on whichever ones should represent the look. A start point is auto-picked per clip (a bit past the start, skipping title cards/cold opens) — nudge and "Set start point" if the auto-pick lands somewhere awkward.
- **Generate montage** — this is the point actual downloading and cutting happens, only for the selected clips: each gets trimmed to a few seconds, center-cropped to a common frame, and concatenated into one GIF, ready to download and drop into an email or a deck.
- **Shared boards** — unlike chop-shop, this isn't single-browser: boards, links and the generated montage are stored centrally so the whole team sees the same project.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it for local dev — with no env vars set, Splice runs on a local SQLite file (`splice-local.sqlite`) and writes generated clips/GIFs into `public/uploads`, so there's nothing to configure just to try it out.

### Deploying it as the team's shared instance

For everyone to see the same boards, point it at real shared storage instead of the local fallback:

1. Create (or reuse) a Vercel project for this app under the FST team org.
2. In the Vercel dashboard, attach a **Postgres** store and a **Blob** store to the project. Vercel populates `POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` automatically once those are attached — see `.env.example`.
3. Deploy. The database tables are created automatically on first use (no separate migration step).
4. Vercel's project settings should use **Node.js 22.x or newer** — this app uses Node's built-in SQLite module for local dev, which needs it (production, with `POSTGRES_URL` set, doesn't touch SQLite at all, but the same runtime version applies either way).

## A note on how links are fetched — read this before using it on real client links

Adding a link and watching it back is just the official embedded player — completely normal, no different from watching it on YouTube directly. It's only when you click **Generate montage** that anything gets downloaded: the server pulls just the needed few-second window from each *selected* clip using [yt-dlp](https://github.com/yt-dlp/yt-dlp), a well-known open-source tool for pulling video from these sites.

**This is against YouTube's and Vimeo's Terms of Service**, even used privately for an internal reference board like this one. It's an extremely common thing for agencies to do informally when pulling together references for a pitch, but it's worth being aware of the tool's stance plainly rather than pretending otherwise. Use it accordingly — internal, unpublished, reference-only.

Some sources also can't be downloaded at all — this only surfaces once you generate a montage that includes them (a failed one is just quietly left out rather than blocking the rest, but it's worth knowing why a clip went missing):
- A handful of Vimeo videos serve their stream behind copy-protected (DRM) segments that can't be decrypted by this or any similar open-source tool.
- Private/unlisted/login-gated videos, or a livestream, won't resolve at all — usually visible earlier, at the collecting stage, since even the embedded player won't play those.

### If YouTube starts blocking links from the deployed site

This is a genuine, ongoing fight between YouTube and tools like yt-dlp over requests from datacenter IPs (Vercel's included) — not a one-time bug with a permanent fix, and it can resurface even after being fixed once. Two independent things to try, and it's worth trying both since they address different layers of the blocking:

**"Sign in to confirm you're not a bot":**
1. In Chrome, while logged into YouTube, install a cookie-export extension such as [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc), open youtube.com, and export a `cookies.txt`.
2. **Use a throwaway/dedicated Google account for this, not a personal one.** The exported cookies are that account's live session — treat the file like a password, and if it's ever a personal account's cookies, whoever holds the file could act as that account on YouTube.
3. Open the file, copy its full contents, and set them as the `YT_COOKIES` environment variable on the Vercel project (Settings → Environments → the relevant environment → Add Environment Variable). Mark it Sensitive.
4. Redeploy.

These session cookies expire after a while (weeks to months) — when links start failing with a sign-in error again, repeat the export and update `YT_COOKIES`.

**"The page needs to be reloaded" (a different block, can happen even with valid cookies):**

As of late 2026, yt-dlp needs an external JavaScript runtime installed to solve YouTube's signature/"n-challenge" — without one, extraction silently degrades or fails outright with exactly this message, regardless of cookies or player client. This is why `bin/deno` is fetched at install time (see below) and passed to every yt-dlp call; this was the actual root cause the first time this surfaced. If it recurs even with Deno present, the app also sends a real browser User-Agent and tries several player-client fallbacks (`default,web_embedded,android,ios`) — check [yt-dlp's open issues](https://github.com/yt-dlp/yt-dlp/issues) for a currently-recommended client combination and set it as `YT_PLAYER_CLIENT` (comma-separated) without a code change.

## Notes on the video engine

`yt-dlp`, `ffmpeg`, and `deno` all run as native binaries on the server, not in the browser (unlike chop-shop's ffmpeg.wasm, which processes files that are already local to the user). `yt-dlp` and `deno` are fetched per-platform by `scripts/fetch-ytdlp.mjs` / `scripts/fetch-deno.mjs` on `npm install` — the right build for whatever OS is doing the install, so this works both for local dev and for a Vercel build (`unzip` needs to be on the build machine's PATH to extract Deno's release archive — present by default on Vercel's build image and on macOS/most Linux). `ffmpeg` comes from the `@ffmpeg-installer/ffmpeg` npm package the same way. Deno is only used as a JS challenge solver for yt-dlp — nothing in this app's own code runs on it.

**Known risk, not fully verified:** Deno's binary is ~80MB uncompressed, on top of yt-dlp (~37MB) and ffmpeg (~35MB) — comfortably under Vercel's serverless function size limit in local testing, but if a deploy ever fails with something like "function size exceeds limit," this is the first place to look (e.g. trimming the player-client list, or moving to a lighter JS runtime if yt-dlp adds support for one).

The montage GIF is encoded at 480px wide, 10fps, with a capped/dithered palette — tuned to keep file size reasonable for emailing or dropping into a slide, at some cost to quality on very high-motion footage.

## Roadmap ideas (not built yet)

- **Drag-to-reorder** — montage order is currently just the order links were added; reordering the selected set before generating would help.
- **A real trim scrubber** — the "start point" nudge is a blunt instrument; a proper in/out scrubber (like chop-shop's `TrimBar`) would make picking the right moment much easier, especially now that the embedded player is right there to scrub against.
- **Direct file links** — chop-shop-style "paste a direct mp4 URL" support alongside YouTube/Vimeo, for when the reference is already hosted somewhere internal.
