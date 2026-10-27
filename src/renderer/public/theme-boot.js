// Synchronous before first paint: dark Mission Control is default (DESIGN.md /
// Stitch). Honor a stored preference when present. A file, not an inline
// script, so the renderer CSP can stay script-src 'self'.
(function () {
  var mode = 'dark';
  try {
    var stored = localStorage.getItem('vibes-theme');
    if (stored === 'light' || stored === 'dark') mode = stored;
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.setAttribute('arco-theme', mode);
})();
