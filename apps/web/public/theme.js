// Applies the saved light/dark choice before first paint, so a forced theme never flashes the system one.
(function () {
  var colors = { light: "#EEF1FA", dark: "#17161A" };
  var theme = null;
  try {
    theme = localStorage.getItem("cf.theme");
  } catch {
    // Storage blocked: follow the system.
  }
  if (theme !== "light" && theme !== "dark") return;
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
    m.setAttribute("content", colors[theme]);
  });
})();
