/* App shell: edition (Create / Work), tabs, sidebar drawer, language, boot */
const App = (() => {

  // A #work / #create hash wins over the stored choice, so a bookmarked link
  // (like the family work entry) always opens the right edition.
  function modeFromHash() {
    const h = (location.hash || '').replace('#', '').toLowerCase();
    return (h === 'work' || h === 'create') ? h : null;
  }
  let MODE = modeFromHash() || Store.get('mode', 'create');   // 'create' | 'work'

  function closeDrawer() {
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('show');
  }
  function toggleDrawer() {
    const open = $('#sidebar').classList.toggle('open');
    $('#scrim').classList.toggle('show', open);
  }

  function showTab(name) {
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'three') {
      ThreeD.initViewport();
      setTimeout(() => ThreeD.onResize(), 50);
    }
  }

  /* Show only the tabs belonging to the current edition. */
  function applyMode(mode) {
    MODE = mode;
    Store.set('mode', mode);
    $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    let visible = [];
    $$('.tab').forEach(b => {
      const m = b.dataset.mode;
      const show = (m === 'both' || m === mode);
      b.classList.toggle('hidden-mode', !show);
      if (show) visible.push(b);
    });

    // if the open tab no longer belongs to this edition, move to the first one
    const active = $('.tab.active');
    if (!active || active.classList.contains('hidden-mode')) {
      if (visible.length) showTab(visible[0].dataset.tab);
    }
  }

  function init() {
    applyI18n();
    $('#btn-lang').onclick = toggleLang;
    $('#btn-menu').onclick = toggleDrawer;
    $('#scrim').onclick = closeDrawer;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $$('.mode-btn').forEach(b => b.addEventListener('click', () => applyMode(b.dataset.mode)));

    Models.init();
    Images.init();
    Video.init();
    Music.init();
    Docs.init();
    Slides.init();
    ThreeD.init();

    applyMode(MODE);

    // a one-shot tab request from the family work entry page
    const entry = Store.get('entryTab', null);
    if (entry) {
      Store.del('entryTab');
      const btn = document.querySelector('.tab[data-tab="' + entry + '"]');
      if (btn && !btn.classList.contains('hidden-mode')) showTab(entry);
    }

    window.addEventListener('hashchange', () => {
      const m = modeFromHash();
      if (m) applyMode(m);
    });

    $('#btn-reset-all').onclick = () => {
      if (confirm(t('t_reset_confirm'))) {
        Store.del('models'); Store.del('gallery');
        Models.renderAll();
        Images.renderGallery();
        toast(t('t_reset_done'));
      }
    };

    /* hide GitHub links until the project is published */
    ['lnk-repo', 'lnk-releases'].forEach(id => {
      const a = document.getElementById(id);
      if (a && a.href.includes('__GHOWNER__')) a.style.display = 'none';
    });

    /* refresh engine list in the background, then refill model selects */
    Engine.fetchEngines().then(() => {
      Models.refreshSelects();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { showTab, applyMode };
})();
window.App = App;
