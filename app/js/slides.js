/* Presentations tool - AI outline + optional AI illustrations, live preview,
   present mode, and export to a real .pptx (plus PDF / HTML). */
const Slides = (() => {
  let deck = [];        // [{ title, bullets: [], imageUrl?, imageBytes? }]
  let current = 0;

  /* ---------- parse the model output into slides ---------- */
  function parse(raw) {
    const text = String(raw || '').replace(/\r/g, '');
    const out = [];
    let cur = null;
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const isTitle = /^(#{1,3}\s+|slide\s*\d+\s*[:.\-]\s*|שקופית\s*\d+\s*[:.\-]\s*)/i.test(t);
      if (isTitle) {
        if (cur) out.push(cur);
        cur = { title: t.replace(/^(#{1,3}\s+|slide\s*\d+\s*[:.\-]\s*|שקופית\s*\d+\s*[:.\-]\s*)/i, '').trim(), bullets: [] };
      } else if (/^[-*•]\s+/.test(t)) {
        if (!cur) cur = { title: '', bullets: [] };
        cur.bullets.push(t.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').trim());
      } else {
        if (!cur) cur = { title: t.replace(/\*\*/g, ''), bullets: [] };
        else if (!cur.title) cur.title = t.replace(/\*\*/g, '');
        else cur.bullets.push(t.replace(/\*\*/g, ''));
      }
    }
    if (cur) out.push(cur);
    return out.filter(s => s.title || s.bullets.length);
  }

  /* ---------- render ---------- */
  function slideMarkup(s, idx) {
    const rtl = Office.isRtlText((s.title || '') + (s.bullets || []).join(' '));
    const esc = x => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    return `<div class="slide ${rtl ? 'rtl' : 'ltr'}" dir="${rtl ? 'rtl' : 'ltr'}">
      <div class="slide-body">
        <h3 class="slide-title" contenteditable="true" data-i="${idx}" data-f="title">${esc(s.title || '')}</h3>
        <div class="slide-accent"></div>
        <ul class="slide-bullets">${(s.bullets || []).map((b, bi) =>
          `<li contenteditable="true" data-i="${idx}" data-f="b" data-b="${bi}">${esc(b)}</li>`).join('')}</ul>
      </div>
      ${s.imageUrl ? `<div class="slide-img"><img src="${s.imageUrl}" alt=""></div>` : ''}
      <div class="slide-num">${idx + 1}</div>
    </div>`;
  }

  function render() {
    const wrap = $('#deck');
    if (!deck.length) {
      wrap.innerHTML = '<p class="doc-empty">' + t('slide_empty') + '</p>';
      $('#slide-export-row').classList.add('hidden');
      return;
    }
    wrap.innerHTML = deck.map(slideMarkup).join('');
    wrap.querySelectorAll('[contenteditable]').forEach(el => {
      el.addEventListener('input', () => {
        const i = +el.dataset.i;
        if (el.dataset.f === 'title') deck[i].title = el.textContent;
        else deck[i].bullets[+el.dataset.b] = el.textContent;
      });
    });
    $('#slide-export-row').classList.remove('hidden');
    $('#slide-count-label').textContent = deck.length;
  }

  /* ---------- generate ---------- */
  async function generate() {
    const topic = $('#slide-topic').value.trim();
    if (!topic) { toast(t('t_need_topic')); return; }
    const count = parseInt($('#slide-count').value, 10) || 6;
    const lang = $('#slide-lang').value;
    const withImages = $('#slide-images').checked;
    const btn = $('#btn-slide-generate');
    const prog = $('#slide-progress');
    btn.disabled = true;

    const langName = lang === 'he' ? 'Hebrew' : lang === 'en' ? 'English' : 'the same language as the topic';
    const prompt =
      'Create a presentation outline in ' + langName + ' about: ' + topic + '.\n' +
      'Exactly ' + count + ' slides. The first slide is the title slide.\n' +
      'Format EVERY slide exactly like this, with no extra text:\n' +
      '## Slide title\n- bullet one\n- bullet two\n- bullet three\n' +
      'Use 2 to 4 short bullets per slide (max 12 words each). No commentary before or after.';

    try {
      setProgress(prog, 15, t('slide_outlining'));
      const raw = await Engine.generateText(prompt);
      deck = parse(raw).slice(0, count);
      if (!deck.length) throw new Error('empty outline');
      render();

      if (withImages) {
        for (let i = 0; i < deck.length; i++) {
          setProgress(prog, 25 + (i / deck.length) * 70, t('slide_illustrating') + ' ' + (i + 1) + '/' + deck.length);
          try {
            const url = Engine.buildImageUrl({
              prompt: deck[i].title + ', ' + topic + ', clean modern presentation illustration, minimal, professional',
              engine: 'sana', width: 768, height: 768, seed: 1000 + i * 37
            });
            const blob = await Engine.fetchBlob(url);
            deck[i].imageBytes = new Uint8Array(await blob.arrayBuffer());
            deck[i].imageUrl = URL.createObjectURL(blob);
            render();
          } catch (e) { /* a slide without an image is fine */ }
        }
      }
      hideProgress(prog);
      toast(t('slide_ready'));
    } catch (e) {
      hideProgress(prog);
      toast(t('slide_fail'));
    }
    btn.disabled = false;
  }

  /* ---------- present mode ---------- */
  function present() {
    if (!deck.length) return;
    current = 0;
    const overlay = $('#present-overlay');
    overlay.classList.remove('hidden');
    paint();
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
  }
  function paint() {
    $('#present-stage').innerHTML = slideMarkup(deck[current], current);
    $('#present-stage').querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = 'false');
    $('#present-pos').textContent = (current + 1) + ' / ' + deck.length;
  }
  function move(d) {
    current = Math.max(0, Math.min(deck.length - 1, current + d));
    paint();
  }
  function exitPresent() {
    $('#present-overlay').classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  /* ---------- exports ---------- */
  function safeName() {
    return ((deck[0] && deck[0].title) || 'presentation').slice(0, 40).replace(/[\\/:*?"<>|]+/g, '').trim() || 'presentation';
  }

  function exportPptx() {
    if (!deck.length) return;
    downloadBlob(Office.buildPptx(deck), safeName() + '.pptx');
    toast(t('slide_exported_pptx'));
  }

  function deckHtml() {
    const esc = x => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const body = deck.map((s, i) => {
      const rtl = Office.isRtlText((s.title || '') + (s.bullets || []).join(' '));
      return `<section dir="${rtl ? 'rtl' : 'ltr'}">
        <h2>${esc(s.title || '')}</h2><div class="bar"></div>
        <ul>${(s.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        <span class="n">${i + 1}</span></section>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(safeName())}</title><style>
body{margin:0;background:#0a0a13;font-family:'Segoe UI',Calibri,Arial,sans-serif}
section{position:relative;width:100%;aspect-ratio:16/9;box-sizing:border-box;padding:8% 9%;
  background:linear-gradient(160deg,#14152a,#0d0e1c);color:#eef0ff;page-break-after:always;
  margin:0 auto 24px;max-width:1100px;border-radius:14px;overflow:hidden}
h2{font-size:2.6vw;margin:0 0 12px}.bar{width:90px;height:5px;background:#22d3ee;border-radius:9px;margin-bottom:22px}
ul{font-size:1.5vw;line-height:1.9;color:#d7daf0;padding-inline-start:22px}
.n{position:absolute;bottom:3%;inset-inline-end:4%;color:#6b74a0;font-size:1.1vw}
@media print{body{background:#fff}section{margin:0;border-radius:0;max-width:none;height:100vh}}
</style></head><body>${body}</body></html>`;
  }

  function exportHtml() {
    if (!deck.length) return;
    downloadBlob(new Blob([deckHtml()], { type: 'text/html;charset=utf-8' }), safeName() + '.html');
    toast(t('t_downloaded'));
  }

  function exportPdf() {
    if (!deck.length) return;
    const w = window.open('', '_blank');
    if (!w) { toast(t('doc_popup_blocked')); return; }
    w.document.write(deckHtml());
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
    toast(t('doc_print_hint'), 5000);
  }

  function addSlide() {
    deck.push({ title: t('slide_new_title'), bullets: [t('slide_new_bullet')] });
    render();
  }

  function init() {
    $('#btn-slide-generate').onclick = generate;
    $('#btn-slide-pptx').onclick = exportPptx;
    $('#btn-slide-pdf').onclick = exportPdf;
    $('#btn-slide-html').onclick = exportHtml;
    $('#btn-slide-present').onclick = present;
    $('#btn-slide-add').onclick = addSlide;
    $('#btn-slide-clear').onclick = () => { deck = []; render(); };
    $('#present-close').onclick = exitPresent;
    $('#present-prev').onclick = () => move(-1);
    $('#present-next').onclick = () => move(1);
    document.addEventListener('keydown', e => {
      if ($('#present-overlay').classList.contains('hidden')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') move(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') move(-1);
      else if (e.key === 'Escape') exitPresent();
    });
    render();
  }

  return { init };
})();
