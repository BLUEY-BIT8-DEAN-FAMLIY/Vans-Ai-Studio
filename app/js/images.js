/* Image generation tab */
const Images = (() => {
  const MAX_GALLERY = 60;

  function gallery() { return Store.get('gallery', []); }
  function saveGallery(g) { Store.set('gallery', g.slice(0, MAX_GALLERY)); }

  function makeCard(item, { small = false } = {}) {
    const div = document.createElement('div');
    div.className = 'imgcard';
    const img = document.createElement('img');
    img.loading = small ? 'lazy' : 'eager';   // results load now; gallery thumbs lazily
    img.alt = item.prompt || '';
    img.title = item.prompt || '';
    Engine.mountImage(img, item.displaySrc || item.url);
    div.appendChild(img);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const dl = iact('⬇️', async () => {
      try { await Engine.download(item.url, 'vans-' + (item.seed || 'img') + '.jpg'); toast(t('t_downloaded')); }
      catch (e) { window.open(item.url, '_blank'); toast(t('t_downloaded')); }
    });
    const cp = iact('📋', async () => {
      try { await navigator.clipboard.writeText(item.prompt || ''); toast(t('t_copied')); } catch (e) {}
    });
    const tv = iact('🎬', () => {
      $('#vid-prompt').value = item.rawPrompt || item.prompt || '';
      window.App.showTab('video');
      toast(t('t_sent_video'));
    });
    const op = iact('🔍', () => window.open(item.url, '_blank'));
    actions.append(dl, cp, tv, op);
    div.appendChild(actions);
    return div;
  }

  function iact(txt, fn) {
    const b = document.createElement('button');
    b.className = 'iact'; b.textContent = txt;
    b.onclick = fn;
    return b;
  }

  function renderGallery() {
    const el = $('#img-gallery');
    el.innerHTML = '';
    gallery().forEach(item => el.appendChild(makeCard(item, { small: true })));
  }

  // Add one new item to the gallery incrementally, reusing the blob we already
  // have (no network, no full rebuild that would reload every other thumbnail).
  function addToGallery(item) {
    const stored = Object.assign({}, item); delete stored.displaySrc;
    const g = gallery(); g.unshift(stored); saveGallery(g);
    const el = $('#img-gallery');
    el.prepend(makeCard(item, { small: true }));
    while (el.children.length > MAX_GALLERY) el.lastElementChild.remove();
  }

  async function generate() {
    const raw = $('#img-prompt').value.trim();
    if (!raw) { toast(t('t_need_prompt')); return; }

    const modelVal = $('#img-model').value;
    const { engine, prompt } = Models.resolve(modelVal, raw);
    const [w, h] = $('#img-size').value.split('x').map(Number);
    const count = parseInt($('#img-count').value, 10) || 1;
    const enhance = $('#img-enhance').checked;
    let baseSeed = $('#img-random-seed').checked ? randSeed() : (parseInt($('#img-seed').value, 10) || 0);
    $('#img-seed').value = baseSeed;

    const results = $('#img-results');
    const btn = $('#btn-generate');
    btn.disabled = true;

    const jobs = [];
    for (let i = 0; i < count; i++) {
      const seed = baseSeed + i * 101;
      const url = Engine.buildImageUrl({ prompt, engine, width: w, height: h, seed, enhance });

      const holder = document.createElement('div');
      holder.className = 'imgcard';
      holder.style.aspectRatio = (w / h);
      holder.innerHTML = '<div class="skeleton"><div class="spinner"></div><span>' + t('t_generating') + '</span></div>';
      results.prepend(holder);

      const job = Engine.resolveDisplaySrc(url).then((src) => {
        const item = { url, displaySrc: src, prompt, rawPrompt: raw, seed, w, h, model: modelVal, ts: Date.now() };
        holder.replaceWith(makeCard(item));
        addToGallery(item);
      }).catch(() => {
        holder.innerHTML = '<div class="skeleton"><span class="err">' + t('t_img_fail') + '</span><button class="btn small ghost">' + t('t_retry') + '</button></div>';
        holder.querySelector('button').onclick = () => {
          holder.remove();
          generateOne(prompt, raw, engine, w, h, seed + 1, enhance, modelVal);
        };
      });
      jobs.push(job);
    }
    await Promise.allSettled(jobs);
    btn.disabled = false;
  }

  async function generateOne(prompt, raw, engine, w, h, seed, enhance, modelVal) {
    const results = $('#img-results');
    const url = Engine.buildImageUrl({ prompt, engine, width: w, height: h, seed, enhance });
    const holder = document.createElement('div');
    holder.className = 'imgcard';
    holder.innerHTML = '<div class="skeleton"><div class="spinner"></div><span>' + t('t_generating') + '</span></div>';
    results.prepend(holder);
    try {
      const src = await Engine.resolveDisplaySrc(url);
      const item = { url, displaySrc: src, prompt, rawPrompt: raw, seed, w, h, model: modelVal, ts: Date.now() };
      holder.replaceWith(makeCard(item));
      addToGallery(item);
    } catch (e) {
      holder.innerHTML = '<div class="skeleton"><span class="err">' + t('t_img_fail') + '</span></div>';
    }
  }

  async function enhanceNow() {
    const raw = $('#img-prompt').value.trim();
    if (!raw) { toast(t('t_need_prompt')); return; }
    const btn = $('#btn-enhance');
    btn.disabled = true;
    toast(t('t_enhancing'), 15000);
    try {
      const better = await Engine.enhancePrompt(raw);
      if (better) $('#img-prompt').value = better;
      toast('✓ ' + better.slice(0, 80) + '…', 4000);
    } catch (e) {
      toast(t('t_enhance_fail'));
    }
    btn.disabled = false;
  }

  function init() {
    $('#btn-generate').onclick = generate;
    $('#btn-enhance').onclick = enhanceNow;
    $('#btn-clear-gallery').onclick = () => {
      saveGallery([]);
      renderGallery();
      toast(t('t_gallery_cleared'));
    };
    $('#img-random-seed').addEventListener('change', e => {
      $('#img-seed').disabled = e.target.checked;
    });
    $('#img-seed').disabled = true;
    renderGallery();
  }

  return { init, renderGallery };
})();
