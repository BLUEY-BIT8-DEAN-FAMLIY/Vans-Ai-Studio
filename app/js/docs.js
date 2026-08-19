/* Documents tool - AI writing + editing + export to real .docx, PDF, HTML, TXT.
   Text generation goes through the same free, keyless backend as everything else. */
const Docs = (() => {
  let blocks = [];   // [{ type, text }]
  let edited = false;   // set once the user types, so a late AI result never clobbers their work

  const KINDS = {
    article:  { he: 'מאמר',            en: 'Article',        instr: 'a well-structured article' },
    report:   { he: 'דוח',             en: 'Report',         instr: 'a professional business report with sections' },
    letter:   { he: 'מכתב רשמי',       en: 'Formal letter',  instr: 'a formal letter' },
    email:    { he: 'אימייל',          en: 'Email',          instr: 'a clear professional email' },
    summary:  { he: 'סיכום',           en: 'Summary',        instr: 'a concise summary with key points' },
    plan:     { he: 'תוכנית עבודה',    en: 'Work plan',      instr: 'a practical work plan with phases and action items' },
    cv:       { he: 'קורות חיים',      en: 'Resume',         instr: 'a professional resume' },
    protocol: { he: 'פרוטוקול ישיבה',  en: 'Meeting minutes',instr: 'meeting minutes with decisions and action items' }
  };

  /* ---------- parse the model output into document blocks ---------- */
  function parse(raw) {
    const out = [];
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    let first = true;
    for (let line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^#{3,}\s+/.test(t))      out.push({ type: 'h2', text: t.replace(/^#{3,}\s+/, '') });
      else if (/^##\s+/.test(t))    out.push({ type: 'h2', text: t.replace(/^##\s+/, '') });
      else if (/^#\s+/.test(t))     out.push({ type: first ? 'title' : 'h1', text: t.replace(/^#\s+/, '') });
      else if (/^[-*•]\s+/.test(t)) out.push({ type: 'bullet', text: t.replace(/^[-*•]\s+/, '') });
      else if (/^\d+[.)]\s+/.test(t)) out.push({ type: 'number', text: t.replace(/^\d+[.)]\s+/, '') });
      else out.push({ type: first ? 'title' : 'p', text: t });
      first = false;
    }
    // strip markdown emphasis that we do not render
    out.forEach(b => { b.text = b.text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\*\*|\*\*$/g, ''); });
    return out.length ? out : [{ type: 'p', text: String(raw || '').trim() }];
  }

  /* ---------- render the editable preview ---------- */
  function render() {
    const page = $('#doc-page');
    page.innerHTML = '';
    if (!blocks.length) {
      page.innerHTML = '<p class="doc-empty">' + t('doc_empty') + '</p>';
      $('#doc-export-row').classList.add('hidden');
      return;
    }
    let list = null;
    blocks.forEach((b, i) => {
      const wantList = (b.type === 'bullet' || b.type === 'number') ? b.type : null;
      if (!wantList) list = null;
      let el;
      if (wantList) {
        const tag = b.type === 'bullet' ? 'ul' : 'ol';
        if (!list || list.tagName.toLowerCase() !== tag) { list = document.createElement(tag); page.appendChild(list); }
        el = document.createElement('li');
      } else {
        el = document.createElement(b.type === 'title' ? 'h1' : b.type === 'h1' ? 'h2' : b.type === 'h2' ? 'h3' : 'p');
        if (b.type === 'title') el.className = 'doc-title';
      }
      el.textContent = b.text;
      el.contentEditable = 'true';
      el.spellcheck = false;
      el.dataset.i = i;
      el.addEventListener('input', () => { blocks[i].text = el.textContent; edited = true; });
      (wantList ? list : page).appendChild(el);
    });
    $('#doc-export-row').classList.remove('hidden');
  }

  /* ---------- generate ---------- */
  async function generate() {
    const topic = $('#doc-topic').value.trim();
    if (!topic) { toast(t('t_need_topic')); return; }
    const kind = $('#doc-kind').value;
    const lang = $('#doc-lang').value;
    const len = $('#doc-len').value;
    const btn = $('#btn-doc-generate');
    const prog = $('#doc-progress');
    btn.disabled = true;
    setProgress(prog, 25, t('doc_writing'));

    const langName = lang === 'he' ? 'Hebrew' : lang === 'en' ? 'English' : 'the same language as the topic';
    const sizes = { short: 'about 250 words', medium: 'about 500 words', long: 'about 900 words' };
    const prompt =
      'Write ' + KINDS[kind].instr + ' in ' + langName + ' about: ' + topic + '.\n' +
      'Length: ' + sizes[len] + '.\n' +
      'Format the answer as plain markdown using ONLY these markers:\n' +
      '# for the document title (exactly one, on the first line)\n' +
      '## for section headings\n' +
      '- for bullet points\n' +
      'plain lines for paragraphs.\n' +
      'Do not use bold, italics, code blocks, tables or any other markup. Do not add any commentary before or after the document.';

    // 1) a structured draft appears immediately, built on this device
    blocks = Templates.document(kind, topic, lang, len);
    edited = false;
    render();
    setProgress(prog, 55, t('doc_trying'));

    // 2) if the online writer is reachable, upgrade the draft in place
    try {
      const raw = await Engine.generateText(prompt);
      const parsed = parse(raw);
      if (parsed.length >= 3 && !edited) {
        blocks = parsed;
        render();
        toast(t('doc_ready'));
      }
    } catch (e) {
      toast(t('doc_offline'), 6000);
    }
    hideProgress(prog);
    btn.disabled = false;
  }

  /* ---------- exports ---------- */
  function safeName() {
    const title = (blocks.find(b => b.type === 'title') || blocks[0] || {}).text || 'document';
    return title.slice(0, 40).replace(/[\\/:*?"<>|]+/g, '').trim() || 'document';
  }

  function exportDocx() {
    if (!blocks.length) return;
    const rtl = Office.isRtlText(blocks.map(b => b.text).join(' '));
    downloadBlob(Office.buildDocx(blocks, { rtl }), safeName() + '.docx');
    toast(t('doc_exported_docx'));
  }

  function exportTxt() {
    if (!blocks.length) return;
    const txt = blocks.map(b => {
      if (b.type === 'title') return b.text + '\n' + '='.repeat(Math.min(60, b.text.length));
      if (b.type === 'h1' || b.type === 'h2') return '\n' + b.text + '\n' + '-'.repeat(Math.min(60, b.text.length));
      if (b.type === 'bullet') return '  • ' + b.text;
      if (b.type === 'number') return '  - ' + b.text;
      return b.text;
    }).join('\n');
    downloadBlob(new Blob([txt], { type: 'text/plain;charset=utf-8' }), safeName() + '.txt');
    toast(t('t_downloaded'));
  }

  function docHtml() {
    const rtl = Office.isRtlText(blocks.map(b => b.text).join(' '));
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    let body = '', list = null;
    for (const b of blocks) {
      if (b.type === 'bullet' || b.type === 'number') {
        const tag = b.type === 'bullet' ? 'ul' : 'ol';
        if (list !== tag) { if (list) body += `</${list}>`; body += `<${tag}>`; list = tag; }
        body += `<li>${esc(b.text)}</li>`;
        continue;
      }
      if (list) { body += `</${list}>`; list = null; }
      if (b.type === 'title') body += `<h1>${esc(b.text)}</h1>`;
      else if (b.type === 'h1') body += `<h2>${esc(b.text)}</h2>`;
      else if (b.type === 'h2') body += `<h3>${esc(b.text)}</h3>`;
      else body += `<p>${esc(b.text)}</p>`;
    }
    if (list) body += `</${list}>`;
    return `<!DOCTYPE html><html lang="${rtl ? 'he' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8">
<title>${esc(safeName())}</title><style>
body{font-family:'Segoe UI',Calibri,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7;color:#111}
h1{font-size:32px;color:#1F3864;margin-bottom:6px}h2{font-size:22px;color:#2E74B5;margin-top:28px}
h3{font-size:18px;color:#2E74B5}li{margin:4px 0}@media print{body{margin:0}}
</style></head><body>${body}</body></html>`;
  }

  function exportHtml() {
    if (!blocks.length) return;
    downloadBlob(new Blob([docHtml()], { type: 'text/html;charset=utf-8' }), safeName() + '.html');
    toast(t('t_downloaded'));
  }

  function exportPdf() {
    if (!blocks.length) return;
    const w = window.open('', '_blank');
    if (!w) { toast(t('doc_popup_blocked')); return; }
    w.document.write(docHtml());
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
    toast(t('doc_print_hint'), 5000);
  }

  function clearDoc() {
    blocks = [];
    render();
  }

  function init() {
    $('#btn-doc-generate').onclick = generate;
    $('#btn-doc-docx').onclick = exportDocx;
    $('#btn-doc-pdf').onclick = exportPdf;
    $('#btn-doc-html').onclick = exportHtml;
    $('#btn-doc-txt').onclick = exportTxt;
    $('#btn-doc-clear').onclick = clearDoc;
    render();
  }

  return { init, get blocks() { return blocks; } };
})();
