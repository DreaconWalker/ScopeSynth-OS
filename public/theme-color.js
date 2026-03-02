(function () {
  var STORAGE_KEY = 'scopesynth_theme_color';
  var DEFAULT = '#e11d48';

  function applyColor(hex) {
    if (!hex || hex.length < 4) hex = DEFAULT;
    document.documentElement.style.setProperty('--theme-accent', hex);
    document.documentElement.style.setProperty('--theme-border', hex + '66');
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.setAttribute('data-theme-accent', '1');
  }

  function initThemeColor() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      applyColor(saved);
    }
    var input = document.getElementById('themeColor');
    if (input) {
      input.value = saved || DEFAULT;
      input.addEventListener('input', function () {
        var hex = this.value;
        applyColor(hex);
        localStorage.setItem(STORAGE_KEY, hex);
      });
      input.addEventListener('change', function () {
        localStorage.setItem(STORAGE_KEY, this.value);
      });
    }
  }

  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved) applyColor(saved);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeColor);
  } else {
    initThemeColor();
  }
})();
