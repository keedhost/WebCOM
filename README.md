# WebCOM — Web Serial Terminal

A browser-based terminal for communicating with serial devices directly from your browser, powered by the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).

**🌐 Live app:** [keedhost.github.io/WebCOM](https://keedhost.github.io/WebCOM/)

---

## Features

- **Multi-tab terminals** — open up to 4 independent serial connections simultaneously
- **Mosaic layout** — split the screen into 2, 3 or 4 tiles with drag-to-resize dividers
- **Port settings** — baud rate, data bits, parity, stop bits, flow control, custom device name
- **10 color themes** — Default Dark, Dracula, Solarized Dark/Light, Nord, Monokai, One Dark, Gruvbox Dark, Tomorrow Night, Material Dark
- **Command panel** — text-based commands for listing ports, connecting, getting device info, and more
- **Control sequences** — one-click sender for Ctrl+C, ESC, CR/LF, function keys, navigation keys
- **8 UI languages** — 🇺🇦 Ukrainian, 🇬🇧 English, 🇫🇷 French, 🇩🇪 German, 🇵🇱 Polish, 🇨🇿 Czech, 🇪🇸 Spanish, 🇵🇹 Portuguese
- **Settings** — font size, theme, port defaults, import/export as JSON — persisted across sessions
- **PWA support** — install as a standalone desktop/mobile app
- **No installation, no build step** — pure HTML + CSS + JS, runs entirely in the browser

---

## Requirements

| Requirement | Details |
|---|---|
| Browser | Chrome 89+ or Edge 89+ (Web Serial API required) |
| Protocol | HTTPS or `localhost` (Web Serial API restriction) |
| OS | Windows, macOS, Linux, ChromeOS |

> **Firefox and Safari** do not support the Web Serial API and cannot run WebCOM.

> **Linux users:** serial ports may be inaccessible if your user is not in the `dialout` group. Run `sudo usermod -aG dialout $USER` and log out/in to fix this.

---

## Getting Started

1. Open **[keedhost.github.io/WebCOM](https://keedhost.github.io/WebCOM/)** in Chrome or Edge
2. Click **Connect port** in the toolbar (or type `connect` in the command panel)
3. Select your serial device from the browser's port picker dialog
4. Configure baud rate and other port settings, then click **Connect**
5. Start sending and receiving data

To open additional terminals, click **+** in the tabs bar or press `Ctrl+T`.  
To split the screen, click the mosaic icon in the toolbar or press `Ctrl+Shift+M`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+T` | New terminal tab |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+1` – `Ctrl+4` | Switch to tab 1–4 |
| `Ctrl+Shift+M` | Toggle mosaic layout |
| `Ctrl+`` ` `` | Toggle command panel |

---

## Command Panel

Open the command panel with the **`>_`** button or `Ctrl+``. Available commands:

| Command | Description |
|---|---|
| `list` | List available serial ports |
| `status` | Show port status |
| `info <port>` | Device details (VID, PID, manufacturer) |
| `connect <port> [baud]` | Connect to a port |
| `disconnect` | Disconnect current terminal |
| `minicom <port> [options]` | Connect with minicom-style flags (`-b`, `-D`, `-8`, `--noinit`, …) |
| `tabs` | List all open terminals |
| `clear` | Clear command panel output |
| `help [cmd]` | Show help |

---

## Settings

Click the **⚙** icon in the toolbar to open Settings:

- **Appearance** — color theme, font size
- **Terminal** — show/hide welcome screen
- **Connection** — skip port settings dialog, default port configuration
- **Language** — UI language
- **Data** — export settings to JSON / import from JSON

Settings are stored in `localStorage` and cookies, and persist across page reloads.

---

## Install as PWA

WebCOM supports installation as a Progressive Web App. In Chrome or Edge, click the **install** button (↓ arrow icon) that appears in the toolbar when the browser detects a supported environment, then follow the browser prompt.

Once installed, WebCOM runs as a standalone window without the browser UI.

---

## Project Structure

```
WebCOM/
├── index.html          # App shell and all modals
├── style.css           # All styles and themes variables
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (caching + offline)
├── favicon.svg
├── icons/
│   ├── icon.svg
│   └── icon-maskable.svg
└── js/
    ├── themes.js       # 10 color theme definitions
    ├── settings.js     # Settings storage (localStorage + cookies)
    ├── i18n.js         # Translations for 8 languages
    ├── cmdpanel.js     # Command panel logic and commands
    └── app.js          # Main application logic
```

No build tools, bundlers, or package managers are required. Open `index.html` directly in a browser or serve with any static file server.

---

## Author

**Andrii Kondratiev**  
🔗 [linkedin.com/in/andriy-kondratyev](https://www.linkedin.com/in/andriy-kondratyev/)

---

## License

This project is licensed under the **GNU General Public License v3.0**.  
See the [LICENSE](LICENSE) file for details, or read the full text at [gnu.org/licenses/gpl-3.0](https://www.gnu.org/licenses/gpl-3.0.html).
