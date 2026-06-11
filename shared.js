const ACTIVATE_SHARED_TAB = "activate-shared-tab";

let activationRequested = false;

function targetFromLocation() {
  try {
    const encodedTarget = window.location.hash.slice(1);
    const targetUrl = decodeURIComponent(encodedTarget);
    return /^(https?|file):/.test(targetUrl) ? targetUrl : null;
  } catch {
    return null;
  }
}

function loadTargetAsFallback() {
  const targetUrl = targetFromLocation();
  if (targetUrl && !document.hidden) {
    window.location.replace(targetUrl);
  }
}

async function getCurrentTabId() {
  try {
    const tab = await chrome.tabs.getCurrent();
    return tab?.id;
  } catch {
    return undefined;
  }
}

async function requestActivation() {
  if (activationRequested || document.hidden) return;

  activationRequested = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: ACTIVATE_SHARED_TAB,
      proxyUrl: window.location.href,
      tabId: await getCurrentTabId()
    });

    if (!response?.activated) {
      window.setTimeout(loadTargetAsFallback, 800);
    }
  } catch {
    window.setTimeout(loadTargetAsFallback, 800);
  }
}

document.addEventListener("visibilitychange", requestActivation);
window.addEventListener("focus", requestActivation);
document.addEventListener("pointerdown", requestActivation);
document.addEventListener("keydown", requestActivation);

requestActivation();
