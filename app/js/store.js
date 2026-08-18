/* Storage, helpers, toast */
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('vans.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem('vans.' + key, JSON.stringify(val)); } catch (e) {}
  },
  del(key) { try { localStorage.removeItem('vans.' + key); } catch (e) {} }
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function randSeed() { return Math.floor(Math.random() * 999999); }

/* seeded rng (mulberry32) */
function makeRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let _toastTimer = null;
function toast(msg, ms = 3200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

async function downloadUrl(url, filename) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('download failed');
  downloadBlob(await r.blob(), filename);
}

function setProgress(el, pct, text) {
  el.classList.remove('hidden');
  el.querySelector('.bar').style.width = Math.max(2, Math.min(100, pct)) + '%';
  el.querySelector('.ptext').textContent = text || '';
}
function hideProgress(el) { el.classList.add('hidden'); }
