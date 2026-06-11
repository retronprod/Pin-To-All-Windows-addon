const MODE_SETTING = "pinMode";
const LEGACY_SHARED_MODE_SETTING = "sharedModeEnabled";
const MODE_SHARED = "shared";
const MODE_DUPLICATE = "duplicate";
const DEFAULT_MODE = MODE_SHARED;

const modeInputs = [...document.querySelectorAll('input[name="pin-mode"]')];
const description = document.getElementById("mode-description");
const status = document.getElementById("status");

function normalizeMode(mode) {
  return mode === MODE_DUPLICATE ? MODE_DUPLICATE : DEFAULT_MODE;
}

function selectedMode() {
  return normalizeMode(modeInputs.find((input) => input.checked)?.value);
}

function setSelectedMode(mode) {
  const normalizedMode = normalizeMode(mode);

  for (const input of modeInputs) {
    input.checked = input.value === normalizedMode;
  }
}

function updateDescription(mode) {
  description.textContent = mode === MODE_SHARED
    ? chrome.i18n.getMessage("modeSharedDescription")
    : chrome.i18n.getMessage("modeDuplicateDescription");
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    [MODE_SETTING]: null,
    [LEGACY_SHARED_MODE_SETTING]: null
  });
  const legacyMode = typeof settings[LEGACY_SHARED_MODE_SETTING] === "boolean"
    ? (settings[LEGACY_SHARED_MODE_SETTING] ? MODE_SHARED : MODE_DUPLICATE)
    : DEFAULT_MODE;
  const mode = settings[MODE_SETTING] || legacyMode;

  setSelectedMode(mode);
  updateDescription(selectedMode());
}

async function saveSettings() {
  const mode = selectedMode();

  await chrome.storage.sync.set({ [MODE_SETTING]: mode });
  updateDescription(mode);
  status.textContent = chrome.i18n.getMessage("settingsSaved");

  window.setTimeout(() => {
    status.textContent = "";
  }, 1200);
}

for (const input of modeInputs) {
  input.addEventListener("change", saveSettings);
}

loadSettings();
