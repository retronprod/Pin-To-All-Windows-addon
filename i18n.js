function localizePage() {
  const locale = chrome.i18n.getUILanguage();
  document.documentElement.lang = locale.startsWith("pl") ? "pl" : "en";

  for (const element of document.querySelectorAll("[data-i18n]")) {
    const message = chrome.i18n.getMessage(element.dataset.i18n);

    if (message) {
      element.textContent = message;
    }
  }
}

localizePage();
