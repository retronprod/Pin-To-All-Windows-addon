const LAZY_PAGE = chrome.runtime.getURL("lazy.html");
const SHARED_PAGE = chrome.runtime.getURL("shared.html");
const ACTIVATE_SHARED_TAB = "activate-shared-tab";
const MODE_SETTING = "pinMode";
const LEGACY_SHARED_MODE_SETTING = "sharedModeEnabled";
const MODE_SHARED = "shared";
const MODE_DUPLICATE = "duplicate";
const TAB_EDIT_RETRY_DELAYS = [150, 300, 600, 1000, 1500];

let activeActivation = null;

function isSupportedUrl(url) {
  return Boolean(url) && /^(https?|file):/.test(url);
}

function isLazyUrl(url) {
  return Boolean(url) && url.startsWith(LAZY_PAGE);
}

function isSharedUrl(url) {
  return Boolean(url) && url.startsWith(SHARED_PAGE);
}

function placeholderUrl(pageUrl, targetUrl) {
  return `${pageUrl}#${encodeURIComponent(targetUrl)}`;
}

function lazyUrl(targetUrl) {
  return placeholderUrl(LAZY_PAGE, targetUrl);
}

function sharedUrl(targetUrl) {
  return placeholderUrl(SHARED_PAGE, targetUrl);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTabEditBusyError(error) {
  return String(error?.message || error).includes("Tabs cannot be edited right now");
}

async function retryTabEdit(action) {
  for (let attempt = 0; attempt <= TAB_EDIT_RETRY_DELAYS.length; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!isTabEditBusyError(error) || attempt === TAB_EDIT_RETRY_DELAYS.length) {
        throw error;
      }

      await sleep(TAB_EDIT_RETRY_DELAYS[attempt]);
    }
  }

  return undefined;
}

function targetFromPlaceholderUrl(url, pageUrl) {
  if (!url?.startsWith(pageUrl)) return null;

  try {
    const encodedTarget = new URL(url).hash.slice(1);
    const targetUrl = decodeURIComponent(encodedTarget);
    return isSupportedUrl(targetUrl) ? targetUrl : null;
  } catch {
    return null;
  }
}

function targetFromLazyUrl(url) {
  return targetFromPlaceholderUrl(url, LAZY_PAGE);
}

function targetFromSharedUrl(url) {
  return targetFromPlaceholderUrl(url, SHARED_PAGE);
}

function proxyTargetFromTab(tab) {
  return targetFromSharedUrl(tab?.url) || targetFromSharedUrl(tab?.pendingUrl);
}

function canonicalPinnedUrl(tab) {
  if (!tab.pinned) return null;

  const targetUrl =
    targetFromLazyUrl(tab.url) ||
    targetFromLazyUrl(tab.pendingUrl) ||
    proxyTargetFromTab(tab) ||
    tab.url ||
    tab.pendingUrl;

  return isSupportedUrl(targetUrl) ? targetUrl : null;
}

async function getMode() {
  const settings = await chrome.storage.sync.get({
    [MODE_SETTING]: null,
    [LEGACY_SHARED_MODE_SETTING]: false
  });

  if (settings[MODE_SETTING] === MODE_SHARED || settings[MODE_SETTING] === MODE_DUPLICATE) {
    return settings[MODE_SETTING];
  }

  return settings[LEGACY_SHARED_MODE_SETTING] ? MODE_SHARED : MODE_DUPLICATE;
}

async function getAllTabs() {
  const windows = await chrome.windows.getAll({ populate: true });
  return windows.flatMap((win) => win.tabs || []);
}

async function getPinnedUrlsExcept(windowId) {
  const allWindows = await chrome.windows.getAll({ populate: true });
  const pinnedUrls = new Set();

  for (const win of allWindows) {
    if (win.id === windowId || !win.tabs) continue;

    for (const tab of win.tabs) {
      const targetUrl = canonicalPinnedUrl(tab);
      if (targetUrl) pinnedUrls.add(targetUrl);
    }
  }

  return pinnedUrls;
}

async function createLazyTab(windowId, targetUrl) {
  return retryTabEdit(() => chrome.tabs.create({
    windowId,
    url: lazyUrl(targetUrl),
    active: false,
    pinned: true
  }));
}

async function createSharedProxy(windowId, targetUrl, index) {
  const createProperties = {
    windowId,
    url: sharedUrl(targetUrl),
    active: false,
    pinned: true
  };

  if (typeof index === "number") {
    createProperties.index = index;
  }

  return retryTabEdit(() => chrome.tabs.create(createProperties));
}

async function findLiveTab(targetUrl, ignoredTabId) {
  const tabs = await getAllTabs();
  return tabs.find((tab) => {
    const tabUrl = tab.url || tab.pendingUrl;
    return tab.id !== ignoredTabId && tab.pinned && tabUrl === targetUrl;
  });
}

async function findProxyTabFromMessage(message, sender) {
  if (Number.isInteger(message?.tabId)) {
    try {
      return await chrome.tabs.get(message.tabId);
    } catch {
      // Fall through to URL-based lookup.
    }
  }

  if (sender.tab?.id) {
    return sender.tab;
  }

  const proxyUrl = message?.proxyUrl;
  if (!isSharedUrl(proxyUrl)) return null;

  const windows = await chrome.windows.getAll({ populate: true });
  const candidates = [];

  for (const win of windows) {
    for (const tab of win.tabs || []) {
      if (tab.url === proxyUrl) {
        candidates.push({ tab, window: win });
      }
    }
  }

  return (
    candidates.find((candidate) => candidate.window.focused && candidate.tab.active)?.tab ||
    candidates.find((candidate) => candidate.tab.active)?.tab ||
    candidates[0]?.tab ||
    null
  );
}

async function moveLiveTabToProxy(liveTab, proxyTab) {
  try {
    return await retryTabEdit(() => chrome.tabs.move(liveTab.id, {
      windowId: proxyTab.windowId,
      index: proxyTab.index
    }));
  } catch (error) {
    console.warn("Pinned tab move failed, retrying as an unpinned move.", error);
    await retryTabEdit(() => chrome.tabs.update(liveTab.id, { pinned: false }));
    return retryTabEdit(() => chrome.tabs.move(liveTab.id, { windowId: proxyTab.windowId }));
  }
}

async function activateSharedTab(proxyTab) {
  const targetUrl = proxyTargetFromTab(proxyTab);
  if (!targetUrl) return false;

  const liveTab = await findLiveTab(targetUrl, proxyTab.id);

  if (!liveTab) {
    await retryTabEdit(() => chrome.tabs.update(proxyTab.id, { url: targetUrl }));
    return true;
  }

  if (liveTab.windowId === proxyTab.windowId) {
    await retryTabEdit(() => chrome.tabs.update(liveTab.id, { active: true, pinned: true }));
    await retryTabEdit(() => chrome.tabs.remove(proxyTab.id));
    return true;
  }

  const previousWindowId = liveTab.windowId;
  const previousIndex = liveTab.index;

  await moveLiveTabToProxy(liveTab, proxyTab);
  await retryTabEdit(() => chrome.tabs.update(liveTab.id, { active: true, pinned: true }));
  await retryTabEdit(() => chrome.tabs.remove(proxyTab.id));
  await createSharedProxy(previousWindowId, targetUrl, previousIndex);
  return true;
}

async function activateWithLock(task) {
  if (activeActivation) return activeActivation;

  activeActivation = (async () => {
    await sleep(120);

    try {
      return await task();
    } catch (error) {
      console.error("Could not activate shared pinned tab.", error);
      return false;
    } finally {
      activeActivation = null;
    }
  })();

  return activeActivation;
}

async function activateTabById(tabId) {
  const tab = await chrome.tabs.get(tabId);

  if (tab.pinned) {
    const lazyTarget = targetFromLazyUrl(tab.url) || targetFromLazyUrl(tab.pendingUrl);
    if (lazyTarget) {
      await retryTabEdit(() => chrome.tabs.update(tabId, { url: lazyTarget }));
      return true;
    }
  }

  if (!tab.pinned || !proxyTargetFromTab(tab)) return false;
  return activateSharedTab(tab);
}

async function activateActiveProxyInWindow(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return false;

  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (!tab?.pinned || !proxyTargetFromTab(tab)) return false;
  return activateSharedTab(tab);
}

chrome.windows.onCreated.addListener(async (newWindow) => {
  const pinnedUrls = await getPinnedUrlsExcept(newWindow.id);
  const mode = await getMode();

  for (const url of pinnedUrls) {
    if (mode === MODE_SHARED) {
      await createSharedProxy(newWindow.id, url);
    } else {
      await createLazyTab(newWindow.id, url);
    }
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await activateWithLock(async () => {
    return activateTabById(tabId);
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const hasLazyTarget = targetFromLazyUrl(tab.url) || targetFromLazyUrl(tab.pendingUrl);
  const hasSharedTarget = proxyTargetFromTab(tab);

  if (!tab.active || !tab.pinned || (!hasLazyTarget && !hasSharedTarget)) return;
  if (!changeInfo.url && changeInfo.status !== "complete") return;

  await activateWithLock(async () => {
    return activateTabById(tabId);
  });
});

chrome.tabs.onHighlighted.addListener(async ({ tabIds }) => {
  const tabId = tabIds[tabIds.length - 1];

  await activateWithLock(async () => {
    return activateTabById(tabId);
  });
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await activateWithLock(async () => {
    return activateActiveProxyInWindow(windowId);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== ACTIVATE_SHARED_TAB) return false;

  activateWithLock(async () => {
    const tab = await findProxyTabFromMessage(message, sender);
    if (!tab?.pinned || !proxyTargetFromTab(tab)) return false;
    return activateSharedTab(tab);
  }).then((activated) => sendResponse({ ok: true, activated }));

  return true;
});
