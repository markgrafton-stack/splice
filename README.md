# Splice

Internal FST tool: paste in the films, ads and edits that capture a client's look, catalogue them on a shared board per project, and cut a GIF montage of the collection to send along or drop into a deck.

Sibling tool to [chop-shop](../chop-shop) — same brand, opposite end of a project: chop-shop cuts the content you're shipping, Splice collects the references you're pitching from.

## What it does

- **Paste a link** — YouTube or Vimeo. The app resolves the title/thumbnail/duration and pulls a short snippet (not the whole video) in the background.
- **Auto snippet** — a few seconds are grabbed automatically from a bit past the start of each clip (skipping title cards/cold opens). Nudge the start point and hit "Regenerate" if the auto-pick lands somewhere awkward.
- **Per-clip GIF preview** — every entry gets its own small preview GIF as soon as it's ready.
- **Montage** — once at least two clips are ready, "Generate montage" concatenates them (in the order they were added, each center-cropped to a common frame) into one GIF and encodes it, ready to download and drop into an email or a deck.
- **Shared boards** — unlike chop-shop, this isn't single-browser: boards, links and generated GIFs are stored centrally so the whole team sees the same project.

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

There's no way to clip a YouTube/Vimeo video from inside a browser tab — the video is never actually delivered to the page as a file you can cut. So when a link is added, the server downloads just the needed few-second window using [yt-dlp](https://github.com/yt-dlp/yt-dlp), a well-known open-source tool for pulling video from these sites.

**This is against YouTube's and Vimeo's Terms of Service**, even used privately for an internal reference board like this one. It's an extremely common thing for agencies to do informally when pulling together references for a pitch, but it's worth being aware of the tool's stance plainly rather than pretending otherwise. Use it accordingly — internal, unpublished, reference-only.

Some sources also can't be downloaded at all and will show a clear error on that entry instead of silently failing:
- A handful of Vimeo videos serve their stream behind copy-protected (DRM) segments that can't be decrypted by this or any similar open-source tool — those entries will report "copy-protected stream."
- Private/unlisted/login-gated videos, or a livestream, won't resolve either.

## Notes on the video engine

`yt-dlp` and `ffmpeg` both run as native binaries on the server, not in the browser (unlike chop-shop's ffmpeg.wasm, which processes files that are already local to the user). `yt-dlp` is fetched per-platform by `scripts/fetch-ytdlp.mjs` on `npm install` — the right build for whatever OS is doing the install, so this works both for local dev and for a Vercel build. `ffmpeg` comes from the `@ffmpeg-installer/ffmpeg` npm package the same way.

Every GIF (per-clip preview and the final montage) is encoded at 480px wide, 10fps, with a capped/dithered palette — tuned to keep file sizes reasonable for emailing or dropping into a slide, at some cost to quality on very high-motion footage.

## Roadmap ideas (not built yet)

- **Drag-to-reorder** — montage order is currently just the order links were added; reordering before generating would help.
- **A real trim scrubber** — the "start offset" nudge is a blunt instrument; a proper in/out scrubber (like chop-shop's `TrimBar`) would make picking the right moment much easier.
- **Cookies for gated sources** — supporting `--cookies-from-browser` would unlock private/unlisted links for whoever added them, at the cost of real complexity (per-user credentials touching a shared server).
- **Direct file links** — chop-shop-style "paste a direct mp4 URL" support alongside YouTube/Vimeo, for when the reference is already hosted somewhere internal.
