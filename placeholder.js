function targetFromLocation() {
  try {
    const encodedTarget = window.location.hash.slice(1);
    const targetUrl = decodeURIComponent(encodedTarget);
    return /^(https?|file):/.test(targetUrl) ? targetUrl : null;
  } catch {
    return null;
  }
}

function faviconUrl(targetUrl) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", targetUrl);
  url.searchParams.set("size", "32");
  return url.toString();
}

function setPlaceholderFavicon() {
  const targetUrl = targetFromLocation();
  const favicon = document.getElementById("target-favicon");

  if (targetUrl && favicon) {
    favicon.href = faviconUrl(targetUrl);
  }
}

setPlaceholderFavicon();
