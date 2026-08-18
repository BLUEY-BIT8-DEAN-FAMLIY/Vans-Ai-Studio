# How Vans AI Studio Works

A complete technical explanation of the app — what each part does, which services it uses, and why it needs no API key.

---

## 1. The big picture

Vans AI Studio is a **single-page web app written in plain HTML, CSS and JavaScript**. There is no build step, no framework, and no backend of our own. The same `app/` folder is shipped four ways:

| Shipping form | How it runs the same `app/` folder |
|---|---|
| **Web** (`vurs`, `Start-Web.bat`) | A tiny local server (`tools/serve.ps1`) serves the folder on `localhost:8765` |
| **Desktop** (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`) | Electron loads `app/index.html` in a native window |
| **Android** (`.apk`) | Capacitor wraps the same folder in a WebView |
| **Hosted** (GitHub Pages) | The folder is published as a static site |

Everything the user creates is generated either by a **free public service** or by an **engine that runs locally in the browser**. No account, no key, no payment.

---

## 2. Where each feature gets its power

| Feature | Engine | Runs where | Needs internet? |
|---|---|---|---|
| Images | Pollinations.ai (Flux / Turbo / Sana) | Cloud, free, keyless | Yes |
| Video | Pollinations frames + Canvas + MediaRecorder | Frames from cloud, assembly local | Yes |
| Music | Custom generative engine (Web Audio) | 100% local | **No** |
| 3D | Custom geometry engine (Three.js + STL export) | 100% local | Only for AI reliefs |
| Models | Style profiles stored in `localStorage` | 100% local | No |

---

## 3. Images — and the two obstacles we had to solve

Image generation calls Pollinations.ai, an open, free, keyless service. You build a URL and the image comes back:

```
https://image.pollinations.ai/prompt/<your prompt>?width=1024&height=1024&model=flux&seed=42
```

That sounds trivial, but two real-world obstacles had to be handled. Both fixes live in [`app/js/engine.js`](app/js/engine.js).

### Obstacle 1 — the bot check blocks browser `fetch()`

Pollinations puts a Cloudflare Turnstile check in front of any request that carries an `Origin` header. In a browser, `fetch()` and `<img crossOrigin>` both send `Origin`, so they get **HTTP 403 "Missing Turnstile token"**. A plain `<img src="...">` sends no `Origin`, so it loads fine.

That is enough to *show* an image, but not enough to *read its pixels* (needed for video frames and 3D reliefs) or to download it, because a plain `<img>` taints the canvas.

**The fix — three routes, picked per environment:**

| Environment | Route used | Why it works |
|---|---|---|
| Local web (`vurs`) | Our own `/proxy` endpoint | The local server fetches server-side — like `curl`, no `Origin`, no bot check |
| Desktop (Electron) | Direct request | `electron/main.js` strips the `Origin` header via `webRequest.onBeforeSendHeaders` |
| Hosted static site | Plain `<img>`, then public CORS proxies | Best effort where no local server exists |

Because the bytes arrive as a real `Blob`, the canvas stays **untainted** — so video recording, 3D reliefs and downloads all work.

### Obstacle 2 — the free tier allows only one request at a time

The anonymous tier answers a burst of parallel requests with **HTTP 429**, and states the limit explicitly:

```json
{"error":"Too Many Requests",
 "message":"Queue full for IP: 1 requests already queued (max: 1)",
 "queueInfo":{"maxAllowed":1,"tier":"anonymous"}}
```

**The fix:** every network call is funnelled through a **serial queue (concurrency 1)** with a short gap after each request, so we never exceed what the free tier allows. Ask for 4 images and they generate one after another instead of all failing at once. The local proxy adds server-side retry with backoff on top.

```js
const REQUEST_GAP_MS = 1200;
let chain = Promise.resolve();
function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.then(() => sleep(REQUEST_GAP_MS), () => sleep(REQUEST_GAP_MS));
  return run;
}
```

> **Note:** heavy use can still trip a temporary IP-level rate limit. It clears by itself after a few minutes.

**Prompt enhancement** sends your idea — Hebrew works well — to `text.pollinations.ai`, which rewrites it as a rich English image prompt.

---

## 4. Models — what a "model" is here

A **Vans AI Studio model is a style profile**, not a neural network trained from scratch. It is a small record that wraps your prompt with style instructions and picks a base engine ([`app/js/models.js`](app/js/models.js)):

```json
{
  "format": "vans-ai-studio-model",
  "name": "Vans Realistic Pro",
  "engine": "flux",
  "prefix": "",
  "suffix": ", ultra realistic professional photo, 50mm lens, natural lighting, sharp focus"
}
```

At generation time the app composes `prefix + your prompt + suffix` and sends it to the chosen engine. That is why models are **instant, free, and shareable as a small file**.

- **Create** — "Create new model": name, description, base engine, style prefix/suffix.
- **Use** — new models appear immediately in the model dropdown for Images and Video.
- **Export / Import** — download as `.vansmodel.json`, share it, import it back.
- **Catalog** — 10 built-in models ship with the app (Realistic Pro, Anime XL, Pixel 8, Render 3D, Watercolor, Logo Vector, Product Shot, Dark Fantasy, Sketch, Neon City).

Your own models live in `localStorage`, so they persist between sessions.

---

## 5. Video

There is no free text-to-video service without a key, so the app builds video the way a motion-graphics tool does ([`app/js/video.js`](app/js/video.js)):

1. **Generate scenes** — one AI image per scene, each with a different seed.
2. **Animate** — draw them to a `<canvas>` with cinematic motion (Ken Burns pan+zoom, zoom in, zoom out) and cross-fades between scenes.
3. **Record** — `canvas.captureStream(30)` feeds a `MediaRecorder` (VP9) that produces a **WebM** file you can download.

Everything after the images is local, so length and motion cost nothing extra.

---

## 6. Music — fully offline

[`app/js/music.js`](app/js/music.js) is a complete generative composer written on the Web Audio API. Nothing is downloaded; it works with the network switched off.

- **Genres**: Lo-Fi, Chiptune, Techno, Ambient — each with its own tempo range, scale, waveform, chord progression, drum pattern and swing.
- **Composition**: a seeded RNG picks a key and walks a melody through the scale, snapping to chord tones on strong beats, over a generated bass line, pads, arpeggios and drums.
- **Synthesis**: oscillators, envelopes, filters, a delay send and a compressor render through an `OfflineAudioContext` (faster than real time).
- **Export**: the buffer is encoded to a **WAV** file in JavaScript.

The same `seed` always produces the same track, so you can save and reproduce a result.

---

## 7. 3D — printable models

[`app/js/three-d.js`](app/js/three-d.js) builds real, watertight geometry and exports **STL at 1 unit = 1 mm**, ready for XMaker, Bambu Studio, Cura, PrusaSlicer or any slicer.

| Mode | How it is built |
|---|---|
| **3D text** | The text is rasterised to a canvas, then the mask is extruded into a solid — so **any language works, including Hebrew** |
| **Relief / lithophane** | An AI image (or your own upload) is converted to a height map; brightness becomes thickness. "Invert" gives a backlit lithophane |
| **Vase** | A parametric profile curve revolved with `LatheGeometry`, with adjustable height, radius and wave count |
| **Basic shapes** | Box, sphere, cylinder, torus at exact millimetre sizes |

Height-map modes go through one shared routine that generates a **closed solid**: a top surface, a flat bottom, and side walls — which is what a slicer needs. Geometry is built Z-up (print orientation) and rotated only for on-screen preview.

---

## 8. The interface

- **Side menu** — navigation lives in a sidebar on the leading edge: **right in Hebrew (RTL), left in English (LTR)**. It flips automatically with the language.
- **Mobile** — under 820px the sidebar becomes a slide-in drawer with a hamburger button.
- **Bilingual** — full Hebrew and English UI, switched with the language button; the whole layout mirrors using CSS logical properties.
- **Gallery** — generated images are kept in `localStorage` with their prompt and seed.

---

## 9. Project structure

```
Vans Ai Studio/
├── app/                    # the entire application (shared by every platform)
│   ├── index.html          # layout: sidebar + tab panels
│   ├── css/style.css       # dark theme, sidebar, responsive drawer
│   ├── js/
│   │   ├── engine.js       # free backend access: proxy routing + serial queue
│   │   ├── models.js       # custom model system (create/export/import)
│   │   ├── images.js       # image tab + gallery
│   │   ├── video.js        # scene generation + canvas recording
│   │   ├── music.js        # generative music + WAV encoder
│   │   ├── three-d.js      # geometry engine + STL export
│   │   ├── i18n.js         # Hebrew / English strings
│   │   ├── store.js        # localStorage, helpers, seeded RNG
│   │   └── app.js          # tabs, drawer, boot
│   └── vendor/             # Three.js r147, OrbitControls, STLExporter
├── electron/main.js        # desktop window + Origin-header stripping
├── tools/serve.ps1         # local web server + image proxy (concurrent)
├── installers/             # one-line installers for the `vurs` command
├── .github/workflows/      # cloud builds: exe / dmg / AppImage / apk + Pages
├── vurs, vurs.bat          # launcher command
└── publish.ps1             # one-shot GitHub publish
```

---

## 10. Running and building

Run the web version with no dependencies at all:

```bash
vurs
```

Run the Electron desktop app:

```bash
npm install && npm start
```

Installers for **all five platforms** are built in the cloud by GitHub Actions when a `v*` tag is pushed — see `.github/workflows/release.yml`. Building locally is not required (and a Windows machine cannot produce a macOS `.dmg` or an Android `.apk` anyway).

---

## 11. Honest limitations

- Image and video generation depend on a **free public service**; under load it can be slow, and heavy use trips a temporary rate limit.
- A "model" is a **style profile**, not a fine-tuned neural network — that is the trade that keeps it instant, free and shareable.
- Video is **AI stills with cinematic motion**, not frame-by-frame generated video.
- Music is **algorithmic**, not a text-to-music neural model.

Every one of these is a deliberate choice to keep the whole studio genuinely free and key-free.
