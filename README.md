# Pin To All Windows (lightweight-chromium-addon)

I created this plugin to restore functionality from Arc Browser to Helium. The plugin should also work in other Chromium browsers.

It has two modes:
**Mode 1 – Shared State:** Instead of duplicating pinned tabs and loading the same page in each window, the extension maintains only one active instance of a given page. In other windows, it creates lightweight placeholders for pinned tabs, but they don't load their content into memory. These are called proxies.

**Mode 2 – Duplicate:** Creates a new tab with the "about:blank" URL, instead of loading the entire page a second time, and only sets the correct tab URL after the user clicks.

## Installation [EN]
1. Download `PinToAllW-1.2.zip` from [releases](https://github.com/retronprod/Pin-To-All-Windows-addon/releases)
2. Extract the ZIP to a folder of your choice
3. Open Chrome/Chromium → `chrome://extensions`
4. Enable **Developer mode** (toggle in the top right corner)
5. Click **Load unpacked** and select the extracted folder

## Instalacja [PL]

1. Pobierz `PinToAllW-1.2.zip` z [releases](https://github.com/retronprod/Pin-To-All-Windows-addon/releases)
2. Wypakuj ZIP do wybranego folderu
3. Otwórz Chrome/Chromium → `chrome://extensions`
4. Włącz **Tryb deweloperski** (prawy górny róg)
5. Kliknij **Załaduj rozpakowane** i wybierz wypakowany folder
