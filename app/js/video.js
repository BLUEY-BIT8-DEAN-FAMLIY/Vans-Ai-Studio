/* Video creation: AI scenes + cinematic motion, recorded to WebM.
   Uses the free image engine for frames - no API key. */
const Video = (() => {

  async function create() {
    const raw = $('#vid-prompt').value.trim();
    if (!raw) { toast(t('t_need_prompt')); return; }

    const modelVal = $('#vid-model').value;
    const { engine, prompt } = Models.resolve(modelVal, raw);
    const [w, h] = $('#vid-aspect').value.split('x').map(Number);
    const scenes = parseInt($('#vid-scenes').value, 10);
    const secPerScene = parseFloat($('#vid-scene-sec').value);
    const motion = $('#vid-motion').value;
    const seed = randSeed();

    const btn = $('#btn-video');
    const prog = $('#vid-progress');
    btn.disabled = true;

    try {
      /* 1) generate scene images */
      const imgs = [];
      for (let i = 0; i < scenes; i++) {
        setProgress(prog, (i / scenes) * 55, t('v_loading_scene') + ' ' + (i + 1) + '/' + scenes + '…');
        const url = Engine.buildImageUrl({
          prompt: prompt + ', cinematic still, scene ' + (i + 1),
          engine, width: w, height: h, seed: seed + i * 137
        });
        try { imgs.push(await Engine.loadPixelImage(url)); }
        catch (e) { /* skip a failed scene */ }
      }
      if (imgs.length < 2) throw new Error('not enough scenes');

      /* 2) record canvas animation */
      const blob = await record(imgs, { w, h, secPerScene, motion, seed, prog });

      /* 3) show result */
      const box = $('#vid-result');
      box.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'card result-card';
      const video = document.createElement('video');
      video.controls = true; video.loop = true; video.autoplay = true; video.muted = true;
      video.src = URL.createObjectURL(blob);
      const dl = document.createElement('button');
      dl.className = 'btn accent'; dl.style.marginTop = '12px';
      dl.textContent = t('v_download');
      dl.onclick = () => downloadBlob(blob, 'vans-video-' + seed + '.webm');
      card.append(video, dl);
      box.appendChild(card);
      hideProgress(prog);
      toast(t('v_done'));
    } catch (e) {
      hideProgress(prog);
      toast(t('v_fail'));
    }
    btn.disabled = false;
  }

  function record(imgs, { w, h, secPerScene, motion, seed, prog }) {
    return new Promise((resolve, reject) => {
      const n = imgs.length;
      const total = n * secPerScene;
      const fade = Math.min(0.6, secPerScene / 4);
      const fps = 30;

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');

      const rng = makeRng(seed);
      const moves = imgs.map(() => {
        if (motion === 'zoomin') return { s0: 1.0, s1: 1.16, dx: 0, dy: 0 };
        if (motion === 'zoomout') return { s0: 1.16, s1: 1.0, dx: 0, dy: 0 };
        return {
          s0: 1.02 + rng() * 0.05, s1: 1.1 + rng() * 0.1,
          dx: (rng() - 0.5) * 0.14, dy: (rng() - 0.5) * 0.14
        };
      });

      const stream = canvas.captureStream(fps);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      rec.onerror = e => reject(e);

      function drawCover(img, mv, p, alpha) {
        const scale = mv.s0 + (mv.s1 - mv.s0) * p;
        const cover = Math.max(w / img.width, h / img.height) * scale;
        const iw = img.width * cover, ih = img.height * cover;
        const x = (w - iw) / 2 + mv.dx * w * p;
        const y = (h - ih) / 2 + mv.dy * h * p;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, x, y, iw, ih);
        ctx.globalAlpha = 1;
      }

      rec.start(250);
      const t0 = performance.now();

      function frame() {
        const tSec = (performance.now() - t0) / 1000;
        if (tSec >= total) { rec.stop(); return; }
        const idx = Math.min(n - 1, Math.floor(tSec / secPerScene));
        const p = (tSec - idx * secPerScene) / secPerScene;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        drawCover(imgs[idx], moves[idx], p, 1);

        const fadeStart = 1 - fade / secPerScene;
        if (p > fadeStart && idx < n - 1) {
          const q = (p - fadeStart) / (fade / secPerScene);
          drawCover(imgs[idx + 1], moves[idx + 1], 0, q);
        }
        setProgress(prog, 55 + (tSec / total) * 45, t('v_recording') + ' ' + Math.round((tSec / total) * 100) + '%');
        requestAnimationFrame(frame);
      }
      frame();
    });
  }

  function init() {
    $('#btn-video').onclick = create;
  }

  return { init };
})();
