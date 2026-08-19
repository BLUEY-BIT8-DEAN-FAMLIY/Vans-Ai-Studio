/* Free generation backend - no API key.
   Images/text: Pollinations.ai open endpoints.

   Two things make this work with zero key:
   1) Pollinations gates browser requests that carry an Origin header (fetch /
      crossOrigin img) behind a bot-check. So DISPLAY uses a plain <img> (no
      Origin) and PIXEL/download access goes through a fetch chain:
        a. same-origin /proxy (our local server fetches server-side, like curl);
        b. a direct request (works in the Electron app, which strips Origin);
        c. public CORS proxies (last resort for a static web host).
   2) The free engine rate-limits concurrent requests hard (~1 at a time), so
      every request is funnelled through a serial queue. No bursts, no failures. */
const Engine = (() => {
  const IMG_BASE = 'https://image.pollinations.ai';
  const TXT_BASE = 'https://text.pollinations.ai';

  let engineList = ['flux', 'turbo', 'sana'];

  const isLocalHttp = /^https?:$/.test(location.protocol) &&
                      (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  const localProxy = isLocalHttp ? (location.origin + '/proxy?url=') : null;
  const isElectron = /electron/i.test(navigator.userAgent);
  // true when we can fetch real bytes (local proxy, or Electron which strips Origin)
  const canProxy = !!localProxy || isElectron;

  /* ---- serial queue (concurrency 1) ----
     Pollinations' anonymous tier allows only ONE request queued per IP at a time
     ("maxAllowed: 1"). We run strictly one at a time and leave a short gap after
     each so the previous request fully clears their queue before the next. */
  const REQUEST_GAP_MS = 1200;
  let chain = Promise.resolve();
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function enqueue(task) {
    const run = chain.then(task, task);
    chain = run.then(() => sleep(REQUEST_GAP_MS), () => sleep(REQUEST_GAP_MS));
    return run;
  }

  function methodsFor(url) {
    // Local server: only the same-origin proxy works in-browser (it retries
    // server-side); direct/public routes are always bot-blocked, so skip them.
    if (localProxy) return [localProxy + encodeURIComponent(url)];
    // Electron strips Origin, so a direct request succeeds.
    if (isElectron) return [url];
    // Static web host: try direct, then public CORS proxies as a best effort.
    return [
      url,
      'https://corsproxy.io/?url=' + encodeURIComponent(url),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
    ];
  }

  function looksBlocked(txt) {
    return !txt || txt.includes('Turnstile') || txt.startsWith('proxy') || txt.includes('"error"');
  }

  // raw (unqueued) helpers - never call these from another queued task
  async function _blob(url) {
    let lastErr;
    for (const m of methodsFor(url)) {
      try {
        const r = await fetch(m, { signal: AbortSignal.timeout(120000) });
        if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
        const b = await r.blob();
        if (b.size > 200 && (b.type.startsWith('image') || b.type === 'application/octet-stream')) return b;
        lastErr = new Error('bad blob ' + b.type + '/' + b.size);
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('image fetch failed');
  }

  async function _text(url, timeoutMs) {
    let lastErr;
    for (const m of methodsFor(url)) {
      try {
        const r = await fetch(m, { signal: AbortSignal.timeout(timeoutMs || 45000) });
        if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
        const txt = await r.text();
        if (!looksBlocked(txt)) return txt;
        lastErr = new Error('blocked');
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('text fetch failed');
  }

  function _loadPlain(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let done = false;
      const fin = (fn, a) => { if (!done) { done = true; fn(a); } };
      img.onload = () => fin(resolve, img);
      img.onerror = () => fin(reject, new Error('img load failed'));
      if (timeoutMs) setTimeout(() => fin(reject, new Error('img timeout')), timeoutMs);
      img.src = url;
    });
  }

  function _decode(objUrl) {
    return new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode failed'));
      i.src = objUrl;
    });
  }

  /* ---------------- public API (all serialized) ---------------- */

  function buildImageUrl({ prompt, engine = 'flux', width = 1024, height = 1024, seed, enhance = false }) {
    const p = encodeURIComponent(prompt.trim());
    const q = new URLSearchParams({
      width: String(width), height: String(height), model: engine,
      nologo: 'true', referrer: 'vans-ai-studio'
    });
    if (seed !== undefined && seed !== null && seed !== '') q.set('seed', String(seed));
    if (enhance) q.set('enhance', 'true');
    return IMG_BASE + '/prompt/' + p + '?' + q.toString();
  }

  async function fetchEngines() {
    try {
      const txt = await enqueue(() => _text(IMG_BASE + '/models'));
      const j = JSON.parse(txt);
      if (Array.isArray(j) && j.length) {
        const set = new Set(['flux', 'turbo']);
        j.forEach(x => { if (typeof x === 'string') set.add(x); });
        engineList = Array.from(set).slice(0, 14);
      }
    } catch (e) { /* keep defaults */ }
    return engineList;
  }

  function enhancePrompt(text) {
    const instr = 'You are an expert image prompt engineer. Rewrite the following idea as one vivid, detailed English image-generation prompt (max 60 words). Reply with the prompt text only, no quotes, no explanations:\n' + text;
    return enqueue(() => _text(TXT_BASE + '/' + encodeURIComponent(instr)))
      .then(out => out.trim().replace(/^["']+|["']+$/g, '').slice(0, 800));
  }


  // Free text generation (used by the Documents and Presentations tools).
  function generateText(prompt, opts) {
    const o = opts || {};
    const q = new URLSearchParams();
    if (o.json) q.set('json', 'true');
    q.set('referrer', 'vans-ai-studio');
    const url = TXT_BASE + '/' + encodeURIComponent(prompt) + '?' + q.toString();
    // short timeout: the Work tools fall back to the local builder, so a slow or
    // unavailable writer must not keep the user waiting
    return enqueue(() => _text(url, o.timeoutMs || 18000)).then(s => s.trim());
  }
  // DISPLAY: resolve a usable src. Where we can fetch bytes (local proxy / Electron)
  // use the reliable proxy; on a plain static host fall back to a no-Origin <img>.
  function resolveDisplaySrc(url) {
    return enqueue(async () => {
      if (canProxy) {
        try { return URL.createObjectURL(await _blob(url)); } catch (e) { /* try plain */ }
      }
      try { await _loadPlain(url, 30000); return url; }
      catch (e) {
        if (canProxy) return URL.createObjectURL(await _blob(url));
        throw e;
      }
    });
  }

  // PIXEL-safe image (untainted canvas): always via blob
  function loadPixelImage(url) {
    return enqueue(async () => {
      const objUrl = URL.createObjectURL(await _blob(url));
      try { const img = await _decode(objUrl); img._objUrl = objUrl; return img; }
      catch (e) { URL.revokeObjectURL(objUrl); throw e; }
    });
  }

  function fetchBlob(url) { return enqueue(() => _blob(url)); }

  function download(url, filename) {
    return enqueue(() => _blob(url)).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    });
  }

  // Point an <img> at a URL using the most reliable route for this environment.
  // Local: load straight through the same-origin proxy (server is concurrent and
  // caches) so thumbnails never touch the client request queue. Electron/static:
  // plain src, repaired via the proxy queue only if it fails.
  function mountImage(imgEl, url) {
    if (/^blob:|^data:/.test(url)) { imgEl.src = url; return; }
    if (localProxy) { imgEl.src = localProxy + encodeURIComponent(url); return; }
    imgEl.src = url;
    imgEl.addEventListener('error', function onErr() {
      imgEl.removeEventListener('error', onErr);
      enqueue(() => _blob(url)).then(b => { imgEl.src = URL.createObjectURL(b); }).catch(() => {});
    });
  }

  return {
    buildImageUrl, fetchEngines, enhancePrompt, generateText,
    resolveDisplaySrc, loadPixelImage, fetchBlob, download, mountImage,
    get engines() { return engineList; }
  };
})();
