/* Custom model system: style profiles over open base engines.
   Users can create, "train" (build), export, import and use models. */
const Models = (() => {
  const CATALOG = [
    { id: 'vans-realistic', name: 'Vans Realistic Pro', engine: 'flux',
      desc: { he: 'ריאליזם צילומי מקצועי — תאורה טבעית ופרטים חדים', en: 'Professional photorealism - natural light, sharp detail' },
      prefix: '', suffix: ', ultra realistic professional photo, 50mm lens, natural lighting, sharp focus, high detail' },
    { id: 'vans-anime', name: 'Vans Anime XL', engine: 'flux',
      desc: { he: 'סגנון אנימה יפני צבעוני ונקי', en: 'Clean colorful Japanese anime style' },
      prefix: '', suffix: ', anime style, vibrant colors, studio ghibli inspired, clean line art, detailed background' },
    { id: 'vans-pixel', name: 'Vans Pixel 8', engine: 'flux',
      desc: { he: 'פיקסל־ארט רטרו של משחקי 8-ביט', en: 'Retro 8-bit game pixel art' },
      prefix: 'pixel art of', suffix: ', 8-bit retro game style, limited color palette, crisp pixels' },
    { id: 'vans-render', name: 'Vans Render 3D', engine: 'flux',
      desc: { he: 'רינדור תלת־ממד קולנועי באיכות אולפן', en: 'Cinematic studio-grade 3D render' },
      prefix: '', suffix: ', 3d render, octane render, soft studio lighting, subsurface scattering, high poly, 4k' },
    { id: 'vans-water', name: 'Vans Watercolor', engine: 'flux',
      desc: { he: 'ציור בצבעי מים עדינים על נייר', en: 'Delicate watercolor painting on paper' },
      prefix: 'watercolor painting of', suffix: ', soft washes, paper texture, artistic, dreamy' },
    { id: 'vans-logo', name: 'Vans Logo Vector', engine: 'turbo',
      desc: { he: 'לוגואים וקטוריים מינימליסטיים', en: 'Minimal vector logos' },
      prefix: 'minimal flat vector logo of', suffix: ', clean simple design, solid background, professional branding' },
    { id: 'vans-product', name: 'Vans Product Shot', engine: 'flux',
      desc: { he: 'צילומי מוצר מקצועיים לחנויות', en: 'Professional e-commerce product shots' },
      prefix: 'professional product photography of', suffix: ', studio background, softbox lighting, commercial quality' },
    { id: 'vans-fantasy', name: 'Vans Dark Fantasy', engine: 'flux',
      desc: { he: 'אמנות פנטזיה אפלה ודרמטית', en: 'Dramatic dark fantasy art' },
      prefix: '', suffix: ', dark fantasy art, dramatic lighting, intricate details, epic atmosphere, concept art' },
    { id: 'vans-sketch', name: 'Vans Sketch', engine: 'turbo',
      desc: { he: 'רישום עיפרון בעבודת יד', en: 'Hand-drawn pencil sketch' },
      prefix: 'pencil sketch of', suffix: ', hand drawn, crosshatching, sketchbook style, monochrome' },
    { id: 'vans-neon', name: 'Vans Neon City', engine: 'flux',
      desc: { he: 'סייברפאנק ניאון קולנועי', en: 'Cinematic neon cyberpunk' },
      prefix: '', suffix: ', cyberpunk neon lighting, cinematic, rain reflections, blade runner atmosphere' }
  ];

  const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

  function my() { return Store.get('models', []); }
  function saveMy(list) { Store.set('models', list); }

  function byId(id) {
    return my().find(m => m.id === id) || CATALOG.find(m => m.id === id) || null;
  }

  /* Resolve a select value ("engine:flux" or model id) into generation params */
  function resolve(value, userPrompt) {
    let engine = 'flux', prefix = '', suffix = '';
    if (value && value.startsWith('engine:')) {
      engine = value.slice(7);
    } else {
      const m = byId(value);
      if (m) { engine = m.engine || 'flux'; prefix = m.prefix || ''; suffix = m.suffix || ''; }
    }
    let prompt = (userPrompt || '').trim();
    if (prefix) prompt = prefix.trim() + ' ' + prompt;
    if (suffix) prompt = prompt + suffix;
    return { engine, prompt };
  }

  function descOf(m) {
    if (!m.desc) return '';
    if (typeof m.desc === 'string') return m.desc;
    return m.desc[LANG] || m.desc.he || m.desc.en || '';
  }

  /* Fill the model <select> in the Images & Video tabs */
  function fillSelect(sel, keepValue) {
    const prev = keepValue ? sel.value : null;
    sel.innerHTML = '';
    const gEng = document.createElement('optgroup'); gEng.label = t('eng_group');
    Engine.engines.forEach(e => {
      const o = document.createElement('option');
      o.value = 'engine:' + e;
      o.textContent = e.charAt(0).toUpperCase() + e.slice(1);
      gEng.appendChild(o);
    });
    sel.appendChild(gEng);

    const mine = my();
    if (mine.length) {
      const g = document.createElement('optgroup'); g.label = t('my_group');
      mine.forEach(m => {
        const o = document.createElement('option'); o.value = m.id; o.textContent = m.name;
        g.appendChild(o);
      });
      sel.appendChild(g);
    }

    const gCat = document.createElement('optgroup'); gCat.label = t('cat_group');
    CATALOG.forEach(m => {
      const o = document.createElement('option'); o.value = m.id; o.textContent = m.name;
      gCat.appendChild(o);
    });
    sel.appendChild(gCat);

    if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
    else sel.value = CATALOG[0].id;
  }

  function refreshSelects() {
    fillSelect($('#img-model'), true);
    fillSelect($('#vid-model'), true);
  }

  /* ----- rendering cards ----- */
  function card(m, mine) {
    const div = document.createElement('div');
    div.className = 'card modelcard';
    const color = AVATAR_COLORS[Math.abs(hashCode(m.id)) % AVATAR_COLORS.length];
    div.innerHTML = `
      <div class="mc-head">
        <div class="mc-avatar" style="background:linear-gradient(135deg,${color},#22d3ee55)">${escapeHtml(m.name.charAt(0))}</div>
        <div><h4>${escapeHtml(m.name)}</h4><div class="mc-engine">engine: ${escapeHtml(m.engine || 'flux')}</div></div>
        <span class="badge ${mine ? 'mine' : ''}">${mine ? t('mc_mine') : t('mc_builtin')}</span>
      </div>
      <p>${escapeHtml(descOf(m))}</p>
      <div class="mc-actions"></div>`;
    const actions = div.querySelector('.mc-actions');

    const useBtn = mkBtn('🎨 ' + t('mc_use'), 'btn small primary');
    useBtn.onclick = () => {
      refreshSelects();
      $('#img-model').value = m.id;
      window.App.showTab('images');
      toast(t('t_use_model'));
    };
    actions.appendChild(useBtn);

    const expBtn = mkBtn('📤 ' + t('mc_export'), 'btn small ghost');
    expBtn.onclick = () => exportModel(m);
    actions.appendChild(expBtn);

    if (mine) {
      const delBtn = mkBtn('🗑️ ' + t('mc_delete'), 'btn small ghost danger');
      delBtn.onclick = () => {
        saveMy(my().filter(x => x.id !== m.id));
        renderAll();
        refreshSelects();
        toast(t('t_model_deleted'));
      };
      actions.appendChild(delBtn);
    }
    return div;
  }

  function mkBtn(txt, cls) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = txt;
    return b;
  }

  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderAll() {
    const myEl = $('#my-models'), catEl = $('#model-catalog');
    myEl.innerHTML = ''; catEl.innerHTML = '';
    const mine = my();
    if (!mine.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = LANG === 'he' ? 'עדיין אין מודלים משלך — לחצו על "צור מודל חדש" 👆' : 'No models of your own yet - click "Create new model" 👆';
      myEl.appendChild(p);
    }
    mine.forEach(m => myEl.appendChild(card(m, true)));
    CATALOG.forEach(m => catEl.appendChild(card(m, false)));
    refreshSelects();
  }

  /* ----- export / import ----- */
  function exportModel(m) {
    const data = {
      format: 'vans-ai-studio-model', version: 1,
      id: m.id, name: m.name, desc: m.desc, engine: m.engine,
      prefix: m.prefix || '', suffix: m.suffix || '',
      createdAt: m.createdAt || new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, m.name.replace(/[^\w֐-׿-]+/g, '_') + '.vansmodel.json');
    toast(t('t_model_exported'));
  }

  function importModelFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || d.format !== 'vans-ai-studio-model' || !d.name) throw new Error('bad');
        const list = my().filter(m => m.id !== d.id);
        list.push({
          id: d.id || uid(), name: String(d.name).slice(0, 60), desc: d.desc || '',
          engine: d.engine || 'flux', prefix: String(d.prefix || '').slice(0, 400),
          suffix: String(d.suffix || '').slice(0, 400), createdAt: d.createdAt || new Date().toISOString()
        });
        saveMy(list);
        renderAll();
        toast(t('t_model_imported'));
      } catch (e) { toast(t('t_model_bad_file')); }
    };
    reader.readAsText(file);
  }

  /* ----- create modal + simulated "build" ----- */
  function openModal() {
    const sel = $('#mm-engine');
    sel.innerHTML = '';
    Engine.engines.forEach(e => {
      const o = document.createElement('option'); o.value = e; o.textContent = e;
      sel.appendChild(o);
    });
    $('#mm-name').value = ''; $('#mm-desc').value = '';
    $('#mm-prefix').value = ''; $('#mm-suffix').value = '';
    $('#mm-train').classList.add('hidden');
    $('#mm-save').disabled = false;
    $('#model-modal').classList.remove('hidden');
  }
  function closeModal() { $('#model-modal').classList.add('hidden'); }

  async function buildModel() {
    const name = $('#mm-name').value.trim();
    if (!name) { toast(t('t_need_name')); return; }
    const model = {
      id: 'my-' + uid(), name: name.slice(0, 60),
      desc: $('#mm-desc').value.trim().slice(0, 160),
      engine: $('#mm-engine').value || 'flux',
      prefix: $('#mm-prefix').value.trim().slice(0, 400),
      suffix: $('#mm-suffix').value.trim().slice(0, 400),
      createdAt: new Date().toISOString()
    };
    /* short "build" animation - honest label lives in the modal note */
    const wrap = $('#mm-train');
    wrap.classList.remove('hidden');
    $('#mm-save').disabled = true;
    const prog = wrap.querySelector('.progress') || wrap;
    const steps = [[t('tr_collect'), 25], [t('tr_build'), 55], [t('tr_tune'), 82], [t('tr_save'), 100]];
    for (const [txt, pct] of steps) {
      setProgress(prog, pct, txt);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
    }
    const list = my(); list.push(model); saveMy(list);
    closeModal();
    renderAll();
    toast(t('t_model_saved'));
  }

  function init() {
    $('#btn-new-model').onclick = openModal;
    $('#mm-cancel').onclick = closeModal;
    $('#mm-save').onclick = buildModel;
    $('#model-modal').addEventListener('click', e => { if (e.target.id === 'model-modal') closeModal(); });
    $('#btn-import-model').onclick = () => $('#model-file').click();
    $('#model-file').addEventListener('change', e => {
      if (e.target.files[0]) importModelFile(e.target.files[0]);
      e.target.value = '';
    });
    renderAll();
  }

  return { init, renderAll, refreshSelects, resolve, byId, CATALOG };
})();
