const MODE_SETTING = "pinMode";
const LEGACY_SHARED_MODE_SETTING = "sharedModeEnabled";
const MODE_SHARED = "shared";
const MODE_DUPLICATE = "duplicate";

const modeInputs = [...document.querySelectorAll('input[name="pin-mode"]')];
const description = document.getElementById("mode-description");
const status = document.getElementById("status");

function normalizeMode(mode) {
  return mode === MODE_DUPLICATE ? MODE_DUPLICATE : MODE_SHARED;
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
    ? "Jedna żywa karta jest przenoszona między oknami, a pozostałe okna pokazują lekki placeholder."
    : "Każde nowe okno dostaje własne przypięte kopie kart, ale strony ładują się dopiero po kliknięciu.";
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    [MODE_SETTING]: null,
    [LEGACY_SHARED_MODE_SETTING]: true
  });
  const mode = settings[MODE_SETTING] || (settings[LEGACY_SHARED_MODE_SETTING] ? MODE_SHARED : MODE_DUPLICATE);

  setSelectedMode(mode);
  updateDescription(selectedMode());
}

async function saveSettings() {
  const mode = selectedMode();

  await chrome.storage.sync.set({ [MODE_SETTING]: mode });
  updateDescription(mode);
  status.textContent = "Zapisano";

  window.setTimeout(() => {
    status.textContent = "";
  }, 1200);
}

for (const input of modeInputs) {
  input.addEventListener("change", saveSettings);
}

loadSettings();
