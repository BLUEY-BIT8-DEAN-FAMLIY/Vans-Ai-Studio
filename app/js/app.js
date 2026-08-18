/* App shell: tabs, language, boot */
const App = (() => {

  function showTab(name) {
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'three') {
      ThreeD.initViewport();
      setTimeout(() => ThreeD.onResize(), 50);
    }
  }

  function init() {
    applyI18n();
    $('#btn-lang').onclick = toggleLang;

    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

    Models.init();
    Images.init();
    Video.init();
    Music.init();
    ThreeD.init();

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
  return { showTab };
})();
window.App = App;
