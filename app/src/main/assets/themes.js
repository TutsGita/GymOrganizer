"use strict";

const themeOptions = new Map([
  ["dark", "Escuro · Dracula"],
  ["light", "Claro"],
  ["gruvbox", "Gruvbox"],
  ["nord", "Nord"],
  ["solarized", "Solarized Dark"],
  ["catppuccin", "Catppuccin Mocha"],
  ["tokyo-night", "Tokyo Night"]
]);
const themeStorageKey = "gym-organizer-theme";
let currentTheme = "dark";

try {
  const saved = localStorage.getItem(themeStorageKey);
  if (themeOptions.has(saved)) currentTheme = saved;
} catch {
  // Keep the default when local storage is unavailable.
}
document.documentElement.dataset.theme = currentTheme;

function themes() {
  return heading("Temas") + `<section class="stack theme-list" aria-label="Temas disponíveis">
    ${Array.from(themeOptions, ([key, name]) => `<button type="button" class="theme-option"
      data-action="select-theme" data-value="${key}" aria-pressed="${currentTheme === key}">
      <span class="theme-swatches" data-theme="${key}" aria-hidden="true">
        <span class="theme-swatch"></span><span class="theme-swatch"></span><span class="theme-swatch"></span>
      </span><strong>${name}</strong>
    </button>`).join("")}
    </section>`;
}

function selectTheme(key, control) {
  if (!themeOptions.has(key) || currentTheme === key) return;
  try {
    localStorage.setItem(themeStorageKey, key);
  } catch {
    toast("Não foi possível salvar o tema.");
    return;
  }
  currentTheme = key;
  document.documentElement.dataset.theme = key;
  control.closest(".theme-list").querySelector('[aria-pressed="true"]').setAttribute("aria-pressed", "false");
  control.setAttribute("aria-pressed", "true");
}
