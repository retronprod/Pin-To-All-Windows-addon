# Pin To All Windows (lightweight-chromium-addon)

I created this plugin to restore functionality from Arc Browser to Helium. The plugin should also work in other Chromium browsers.

It has two modes:
**Mode 1 – Shared State:** Instead of duplicating pinned tabs and loading the same page in each window, the extension maintains only one active instance of a given page. In other windows, it creates lightweight placeholders for pinned tabs, but they don't load their content into memory. These are called proxies.

**Mode 2 – Duplicate:** Creates a new tab with the "about:blank" URL, instead of loading the entire page a second time, and only sets the correct tab URL after the user clicks.
