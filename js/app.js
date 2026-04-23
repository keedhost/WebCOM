// ─── USB-Serial chip lookup (VID:PID → friendly name) ──────────────────────
const USB_SERIAL_NAMES = {
  '1a86:7523': 'CH340',   '1a86:5523': 'CH341',   '1a86:7522': 'CH340K',
  '10c4:ea60': 'CP2102',  '10c4:ea61': 'CP2103',  '10c4:ea63': 'CP2104',
  '10c4:ea70': 'CP2105',  '10c4:ea71': 'CP2108',
  '0403:6001': 'FT232R',  '0403:6010': 'FT2232H', '0403:6011': 'FT4232H',
  '0403:6014': 'FT232H',  '0403:6015': 'FT231X',
  '067b:2303': 'PL2303',  '067b:23a3': 'PL2303HXD',
  '2341:0042': 'Arduino Mega',      '2341:0043': 'Arduino Uno R3',
  '2341:0001': 'Arduino Uno',       '2341:8036': 'Arduino Leonardo',
  '2341:0010': 'Arduino Mega 2560', '2341:003d': 'Arduino Due',
  '2a03:0042': 'Arduino Mega',      '2a03:0043': 'Arduino Uno',
  '1b4f:9204': 'SparkFun Pro Micro','1b4f:9206': 'SparkFun Pro Micro',
  '239a:000f': 'Feather M0',        '239a:8022': 'Metro M0',
  '303a:1001': 'ESP32-S2',          '303a:1002': 'ESP32-S3',
  '303a:4001': 'ESP32-S2',          '303a:0002': 'ESP32',
  '10c4:ea80': 'CP2110',
};

function resolvePortName(port, fallbackId) {
  const info = port.getInfo?.() ?? {};

  // Some Chromium builds expose extra fields — check them all
  for (const key of ['displayName', 'portName', 'path', 'name', 'friendlyName']) {
    const val = info[key];
    if (typeof val === 'string' && val.trim()) {
      // Strip /dev/ (Linux/macOS) and \\.\  (Windows)
      return val.trim().replace(/^\/dev\//, '').replace(/^\\\\\.\\/,'');
    }
  }

  // USB vendor + product lookup
  if (info.usbVendorId != null && info.usbProductId != null) {
    const key = `${info.usbVendorId.toString(16).padStart(4,'0')}:${info.usbProductId.toString(16).padStart(4,'0')}`;
    if (USB_SERIAL_NAMES[key]) return USB_SERIAL_NAMES[key];
    return `USB ${info.usbVendorId.toString(16).toUpperCase().padStart(4,'0')}:${info.usbProductId.toString(16).toUpperCase().padStart(4,'0')}`;
  }

  return `Port ${fallbackId}`;
}

// ─── ESC / control sequences ───────────────────────────────────────────────
const ESC_CTRL = [
  { label: 'Ctrl+C',  seq: '\x03', title: 'SIGINT — перервати' },
  { label: 'Ctrl+D',  seq: '\x04', title: 'EOF — кінець вводу' },
  { label: 'Ctrl+Z',  seq: '\x1a', title: 'SIGTSTP — призупинити' },
  { label: 'Ctrl+\\', seq: '\x1c', title: 'SIGQUIT — вийти' },
  { label: 'ESC',     seq: '\x1b', title: 'Escape \\x1b' },
  { label: 'Tab',     seq: '\x09', title: 'Horizontal Tab' },
  { label: 'CR',      seq: '\r',   title: 'Carriage Return \\r' },
  { label: 'LF',      seq: '\n',   title: 'Line Feed \\n' },
  { label: 'CR+LF',   seq: '\r\n', title: 'Carriage Return + Line Feed' },
  { label: 'NUL',     seq: '\x00', title: 'Null byte \\x00' },
];

const ESC_NAV = [
  { label: '↑',    seq: '\x1b[A',  title: 'Стрілка вгору' },
  { label: '↓',    seq: '\x1b[B',  title: 'Стрілка вниз' },
  { label: '→',    seq: '\x1b[C',  title: 'Стрілка вправо' },
  { label: '←',    seq: '\x1b[D',  title: 'Стрілка вліво' },
  { label: 'Home', seq: '\x1b[H',  title: 'Home' },
  { label: 'End',  seq: '\x1b[F',  title: 'End' },
  { label: 'PgUp', seq: '\x1b[5~', title: 'Page Up' },
  { label: 'PgDn', seq: '\x1b[6~', title: 'Page Down' },
  { label: 'Ins',  seq: '\x1b[2~', title: 'Insert' },
  { label: 'Del',  seq: '\x1b[3~', title: 'Delete' },
];

const ESC_FN = [
  { label: 'F1',  seq: '\x1bOP'    },
  { label: 'F2',  seq: '\x1bOQ'    },
  { label: 'F3',  seq: '\x1bOR'    },
  { label: 'F4',  seq: '\x1bOS'    },
  { label: 'F5',  seq: '\x1b[15~'  },
  { label: 'F6',  seq: '\x1b[17~'  },
  { label: 'F7',  seq: '\x1b[18~'  },
  { label: 'F8',  seq: '\x1b[19~'  },
  { label: 'F9',  seq: '\x1b[20~'  },
  { label: 'F10', seq: '\x1b[21~'  },
  { label: 'F11', seq: '\x1b[23~'  },
  { label: 'F12', seq: '\x1b[24~'  },
];

// Parse \xNN, \r, \n, \t, \e notation in custom ESC input
function parseEscInput(str) {
  return str
    .replace(/\\x([0-9a-fA-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\e/gi, '\x1b')
    .replace(/\\0/g, '\x00')
    .replace(/\\\\/g, '\\');
}

// ─── TerminalTab ────────────────────────────────────────────────────────────
class TerminalTab {
  constructor(id, app) {
    this.id        = id;
    this.app       = app;
    this.port      = null;
    this.reader    = null;
    this.writer    = null;
    this.term      = null;
    this.fitAddon  = null;
    this.connected = false;
    this.portName  = null;
    this.tileEl    = null;
    this.tabEl     = null;
    this._escVisible = false;
    this._readLoopRunning = false;
    this._readLoopDone    = Promise.resolve(); // resolves when read loop exits
  }

  // ── Build DOM ────────────────────────────────────────────────────────────
  createElements(theme, fontSize) {
    // Tab button
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.id = this.id;
    tab.innerHTML = `
      <span class="tab-dot disconnected"></span>
      <span class="tab-label">Terminal ${this.id}</span>
      <button class="tab-close" title="Закрити (Ctrl+W)" aria-label="Закрити термінал">×</button>`;
    tab.addEventListener('click', e => {
      if (!e.target.classList.contains('tab-close')) this.app.setActive(this.id);
    });
    tab.querySelector('.tab-close').addEventListener('click', e => {
      e.stopPropagation();
      this.app.removeTab(this.id);
    });
    this.tabEl = tab;

    // Terminal tile
    const tile = document.createElement('div');
    tile.className = 'terminal-tile';
    tile.dataset.id = this.id;
    tile.innerHTML = `
      <div class="tile-header">
        <span class="tile-status-dot disconnected"></span>
        <span class="tile-port-name">Не підключено</span>
        <div class="tile-actions">
          <button class="tile-btn tile-btn-connect" title="Вибрати порт та підключити">Підключити</button>
          <button class="tile-btn tile-btn-disconnect" title="Відключитись" style="display:none">Відключити</button>
          <button class="tile-btn-icon tile-btn-settings" title="Налаштування порту">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button class="tile-btn-icon tile-btn-esc" title="ESC коди" style="font-size:10px;font-weight:700">ESC</button>
          <button class="tile-btn-icon tile-btn-clear" title="Очистити термінал">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="tile-terminal-wrap"></div>
      <div class="tile-esc-panel hidden"></div>`;

    // Wire up tile buttons
    const btnConnect    = tile.querySelector('.tile-btn-connect');
    const btnDisconnect = tile.querySelector('.tile-btn-disconnect');
    const btnSettings   = tile.querySelector('.tile-btn-settings');
    const btnEsc        = tile.querySelector('.tile-btn-esc');
    const btnClear      = tile.querySelector('.tile-btn-clear');

    btnConnect.addEventListener('click', async () => {
      try {
        const port = await navigator.serial.requestPort();
        this.app.openSettingsModal(this.id, true, port);
      } catch (e) {
        if (e.name !== 'NotFoundError') {
          this.term?.writeln(`\x1b[31m✗ Помилка вибору порту: ${e.message}\x1b[0m`);
        }
      }
    });
    btnDisconnect.addEventListener('click', () => this.disconnect());
    btnSettings.addEventListener('click',  () => this.app.openSettingsModal(this.id, false, null));
    btnEsc.addEventListener('click',       () => this.toggleEscPanel());
    btnClear.addEventListener('click',     () => this.term?.clear());

    this.tileEl = tile;
    this._buildEscPanel();
    this._initTerminal(theme, fontSize);
    return { tab, tile };
  }

  _buildEscPanel() {
    const panel = this.tileEl.querySelector('.tile-esc-panel');
    const mkBtn = ({ label, seq, title }) => {
      const b = document.createElement('button');
      b.className = 'esc-btn';
      b.textContent = label;
      if (title) b.title = title;
      b.addEventListener('click', () => this.sendData(seq));
      return b;
    };

    const row1 = document.createElement('div'); row1.className = 'esc-row';
    const lbl1 = document.createElement('span'); lbl1.className = 'esc-label'; lbl1.textContent = 'Ctrl:';
    row1.append(lbl1, ...ESC_CTRL.map(mkBtn));

    const row2 = document.createElement('div'); row2.className = 'esc-row';
    const lbl2 = document.createElement('span'); lbl2.className = 'esc-label'; lbl2.textContent = 'Nav:';
    row2.append(lbl2, ...ESC_NAV.map(mkBtn));

    const row3 = document.createElement('div'); row3.className = 'esc-row';
    const lbl3 = document.createElement('span'); lbl3.className = 'esc-label'; lbl3.textContent = 'Fn:';
    row3.append(lbl3, ...ESC_FN.map(mkBtn));

    const row4 = document.createElement('div'); row4.className = 'esc-custom-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'esc-custom-input';
    input.placeholder = 'Довільна послідовність: \\x1b[31m або \\e[2J …';
    input.title = 'Підтримується: \\xNN, \\e (ESC), \\r, \\n, \\t, \\0';
    const sendBtn = document.createElement('button');
    sendBtn.className = 'esc-send-btn';
    sendBtn.textContent = 'Відправити';
    sendBtn.addEventListener('click', () => {
      const parsed = parseEscInput(input.value);
      if (parsed) this.sendData(parsed);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); }
    });
    row4.append(input, sendBtn);

    panel.append(row1, row2, row3, row4);
  }

  _initTerminal(theme, fontSize) {
    const wrap = this.tileEl.querySelector('.tile-terminal-wrap');

    const { FitAddon } = window.FitAddon;
    this.fitAddon = new FitAddon();

    this.term = new Terminal({
      theme:         theme.terminal,
      fontSize:      fontSize,
      fontFamily:    "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 'Courier New', monospace",
      cursorBlink:   true,
      cursorStyle:   'block',
      scrollback:    10000,
      allowTransparency: false,
      convertEol:    false,
    });

    this.term.loadAddon(this.fitAddon);
    this.term.open(wrap);

    // Keyboard input → serial port
    this.term.onData(data => this.sendData(data));

    // Clicking anywhere on the tile refocuses the terminal
    this.tileEl.addEventListener('click', e => {
      if (!e.target.closest('button, select, input, a')) {
        this.term.focus();
      }
    });

    this._showWelcome();
    this.fit();
  }

  _showWelcome() {
    const l = '\x1b[2m';
    const r = '\x1b[0m';
    const a = '\x1b[36m';
    this.term.writeln(`${a}╔══════════════════════════════════════╗${r}`);
    this.term.writeln(`${a}║${r}   WebCom — Web Serial Terminal ${a}     ║${r}`);
    this.term.writeln(`${a}╚══════════════════════════════════════╝${r}`);
    this.term.writeln(`${l}Натисніть [Підключити] щоб вибрати порт.${r}`);
    this.term.writeln(`${l}Web Serial API працює лише через HTTPS або localhost.${r}`);
    this.term.writeln('');
  }

  // ── Connection ────────────────────────────────────────────────────────────
  async connect(port, config, customName = null) {
    try {
      this._setStatus('connecting');
      await port.open(config);
      this.port = port;
      this.writer = port.writable.getWriter();
      this.connected = true;

      this.portName = customName || resolvePortName(port, this.id);

      this._setStatus('connected');
      this._updateHeader();
      this.term.writeln(`\x1b[32m✓ Підключено (${config.baudRate} baud ${config.dataBits}${config.parity[0].toUpperCase()}${config.stopBits})\x1b[0m`);
      this.term.focus();

      // Wire disconnect event (USB unplug etc.)
      port.addEventListener('disconnect', () => this._onUnexpectedDisconnect());

      this._readLoopRunning = true;
      this._readLoopDone = this._readLoop();
    } catch (err) {
      if (err.name === 'NotFoundError') {
        this.term.writeln('\x1b[33m⚠ Вибір порту скасовано.\x1b[0m');
      } else {
        this.term.writeln(`\x1b[31m✗ Помилка підключення: ${err.message}\x1b[0m`);
      }
      this._setStatus('disconnected');
      this._updateHeader();
    }
  }

  async _readLoop() {
    const reader = this.port.readable.getReader();
    this.reader = reader;
    try {
      while (this._readLoopRunning) {
        const { value, done } = await reader.read();
        if (done) break;
        this.term.write(value);
      }
    } catch (err) {
      if (this.connected) {
        this.term.writeln(`\x1b[31m\r\n✗ Помилка читання: ${err.message}\x1b[0m`);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
      this.reader = null;
      if (this.connected) this._cleanupConnection();
    }
  }

  async disconnect() {
    if (!this.connected) return;
    this._readLoopRunning = false;
    this.connected = false;

    // UI оновлюється одразу — до будь-яких async-операцій
    this._setStatus('disconnected');
    this._updateHeader();
    this.term.writeln('\r\n\x1b[33m● Відключено\x1b[0m');

    // Сигналізуємо reader зупинитись (fire-and-forget — не чекаємо завершення)
    this.reader?.cancel().catch(() => {});

    // Чекаємо поки read loop відпустить lock; таймаут 1с як запасний варіант
    await Promise.race([
      this._readLoopDone,
      new Promise(r => setTimeout(r, 1000)),
    ]);

    try { this.writer?.releaseLock(); this.writer = null; } catch { /* ignore */ }
    try { await this.port?.close(); }                      catch { /* ignore */ }
    this.port = null;
  }

  async _cleanupConnection() {
    // Called only on unexpected disconnect (read loop already exited, lock already released)
    this.connected = false;
    try { this.writer?.releaseLock(); this.writer = null; } catch { /* ignore */ }
    try { await this.port?.close(); } catch { /* ignore */ }
    this.port = null;
    this._setStatus('disconnected');
    this._updateHeader();
  }

  _onUnexpectedDisconnect() {
    if (!this.connected) return;
    this.connected = false;
    this._readLoopRunning = false;
    this.term.writeln('\r\n\x1b[31m✗ Пристрій відключено!\x1b[0m');
    this._setStatus('error');
    this._updateHeader();
  }

  async sendData(data) {
    if (!this.connected || !this.writer) return;
    try {
      await this.writer.write(new TextEncoder().encode(data));
    } catch (err) {
      this.term.writeln(`\r\n\x1b[31m✗ Помилка запису: ${err.message}\x1b[0m`);
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  _setStatus(status) {
    const dot1 = this.tabEl?.querySelector('.tab-dot');
    const dot2 = this.tileEl?.querySelector('.tile-status-dot');
    [dot1, dot2].forEach(d => {
      if (!d) return;
      d.className = d.className.replace(/connected|connecting|error|disconnected/g, '').trim();
      d.classList.add(status);
    });
  }

  _updateHeader() {
    const btnC  = this.tileEl.querySelector('.tile-btn-connect');
    const btnD  = this.tileEl.querySelector('.tile-btn-disconnect');
    const label = this.tileEl.querySelector('.tile-port-name');
    const tabLbl = this.tabEl.querySelector('.tab-label');

    if (this.connected) {
      btnC.style.display = 'none';
      btnD.style.display = '';
      label.textContent  = this.portName ?? 'Підключено';
      tabLbl.textContent = this.portName ?? `T${this.id}`;
      this._setStatus('connected');
    } else {
      btnC.style.display = '';
      btnD.style.display = 'none';
      label.textContent  = 'Не підключено';
      tabLbl.textContent = `Terminal ${this.id}`;
      if (!this.tileEl.querySelector('.tile-status-dot.error')) {
        this._setStatus('disconnected');
      }
    }
  }

  toggleEscPanel() {
    const panel = this.tileEl.querySelector('.tile-esc-panel');
    const btn   = this.tileEl.querySelector('.tile-btn-esc');
    this._escVisible = !this._escVisible;
    panel.classList.toggle('hidden', !this._escVisible);
    btn.classList.toggle('active', this._escVisible);
    this.fit();
  }

  // ── Terminal options ──────────────────────────────────────────────────────
  setTheme(theme) {
    this.term?.setOption('theme', theme.terminal);
  }

  setFontSize(size) {
    this.term?.setOption('fontSize', size);
    this.fit();
  }

  fit() {
    requestAnimationFrame(() => {
      try { this.fitAddon?.fit(); } catch { /* ignore */ }
    });
  }

  destroy() {
    this.disconnect().catch(() => {});
    this.term?.dispose();
    this.tileEl?.remove();
    this.tabEl?.remove();
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────
class App {
  constructor() {
    this.settings = new Settings();
    this.tabs      = new Map();   // id -> TerminalTab
    this.nextId    = 1;
    this.activeId  = null;
    this.mosaic    = false;
    this._pendingTabId    = null;
    this._pendingPort     = null; // SerialPort selected before settings modal
    this._connectOnOpen   = true;
  }

  init() {
    this._bindStaticUI();
    this._populateThemes();
    this._populateFontSize();
    this.addTab();
    this._bindKeyboard();
    window.addEventListener('resize', () => this._fitAll());
  }

  // ── Static UI wiring ──────────────────────────────────────────────────────
  _bindStaticUI() {
    document.getElementById('btn-add-tab').addEventListener('click', () => this.addTab());
    document.getElementById('btn-mosaic').addEventListener('click', () => this._toggleMosaic());
    document.getElementById('btn-connect-port').addEventListener('click', async () => {
      if (!this.activeId) return;
      try {
        const port = await navigator.serial.requestPort();
        this.openSettingsModal(this.activeId, true, port);
      } catch (e) {
        if (e.name !== 'NotFoundError') console.error('Web Serial:', e);
      }
    });

    document.getElementById('select-theme').addEventListener('change', e => {
      this.settings.set('theme', e.target.value);
      this._applyTheme(e.target.value);
    });
    document.getElementById('select-font-size').addEventListener('change', e => {
      const size = Number(e.target.value);
      this.settings.set('fontSize', size);
      this.tabs.forEach(t => t.setFontSize(size));
    });

    // Modal close
    document.getElementById('btn-close-modal').addEventListener('click',  () => this._closeModal());
    document.getElementById('btn-port-cancel').addEventListener('click',  () => this._closeModal());
    document.querySelector('.modal-backdrop').addEventListener('click',   () => this._closeModal());

    // Modal connect
    document.getElementById('btn-port-connect').addEventListener('click', () => this._handleConnect());
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  addTab() {
    const id  = this.nextId++;
    const tab = new TerminalTab(id, this);
    const theme    = THEMES[this.settings.get('theme')] ?? THEMES['default-dark'];
    const fontSize = this.settings.get('fontSize');
    const { tab: tabEl, tile } = tab.createElements(theme, fontSize);

    document.getElementById('tabs-list').appendChild(tabEl);
    document.getElementById('terminals-container').appendChild(tile);

    this.tabs.set(id, tab);
    this._updateContainerCount();
    this.setActive(id);
    return tab;
  }

  removeTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.destroy();
    this.tabs.delete(id);
    this._updateContainerCount();

    if (this.activeId === id) {
      const ids = [...this.tabs.keys()];
      if (ids.length > 0) this.setActive(ids.at(-1));
      else { this.activeId = null; this.addTab(); }
    }
  }

  setActive(id) {
    if (!this.tabs.has(id)) return;
    this.activeId = id;
    this.tabs.forEach((t, tid) => {
      t.tabEl.classList.toggle('active', tid === id);
      t.tileEl.classList.toggle('active', tid === id);
    });
    this.tabs.get(id)?.fit();
  }

  // ── Mosaic ────────────────────────────────────────────────────────────────
  _toggleMosaic() {
    this.mosaic = !this.mosaic;
    const container = document.getElementById('terminals-container');
    const btn = document.getElementById('btn-mosaic');
    container.classList.toggle('mosaic', this.mosaic);
    btn.classList.toggle('active', this.mosaic);
    btn.setAttribute('aria-pressed', this.mosaic);
    this._fitAll();
  }

  _updateContainerCount() {
    const n = this.tabs.size;
    document.getElementById('terminals-container').dataset.count = n;
    this._fitAll();
  }

  // ── Settings modal ────────────────────────────────────────────────────────
  openSettingsModal(tabId, connectOnOpen = true, port = null) {
    this._pendingTabId  = tabId;
    this._connectOnOpen = connectOnOpen;
    this._pendingPort   = port;

    // Load saved settings into form
    document.getElementById('cfg-baud').value     = this.settings.get('baudRate');
    document.getElementById('cfg-databits').value  = this.settings.get('dataBits');
    document.getElementById('cfg-parity').value    = this.settings.get('parity');
    document.getElementById('cfg-stopbits').value  = this.settings.get('stopBits');
    document.getElementById('cfg-flow').value      = this.settings.get('flowControl');
    const activeTab = this.tabs.get(tabId);
    document.getElementById('cfg-device-name').value = activeTab?.portName ?? '';

    const btn = document.getElementById('btn-port-connect');
    btn.innerHTML   = connectOnOpen
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Підключити`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Зберегти`;

    document.getElementById('modal-settings').classList.remove('hidden');
  }

  _closeModal() {
    document.getElementById('modal-settings').classList.add('hidden');
    this._pendingTabId = null;
  }

  async _handleConnect() {
    const tabId        = this._pendingTabId;
    const shouldConnect = this._connectOnOpen;
    const port          = this._pendingPort;
    this._pendingPort   = null;

    const config = {
      baudRate:    Number(document.getElementById('cfg-baud').value),
      dataBits:    Number(document.getElementById('cfg-databits').value),
      parity:      document.getElementById('cfg-parity').value,
      stopBits:    Number(document.getElementById('cfg-stopbits').value),
      flowControl: document.getElementById('cfg-flow').value,
    };

    const rawName = document.getElementById('cfg-device-name').value.trim();
    const customName = rawName
      ? rawName.replace(/^~\//, '').replace(/^\/dev\//, '').replace(/^\\\\\.\\/,'')
      : null;

    this.settings.setMany({
      baudRate:    config.baudRate,
      dataBits:    config.dataBits,
      parity:      config.parity,
      stopBits:    config.stopBits,
      flowControl: config.flowControl,
    });

    this._closeModal();

    if (shouldConnect && tabId != null && port) {
      const tab = this.tabs.get(tabId);
      if (tab) await tab.connect(port, config, customName);
    } else if (!shouldConnect && tabId != null && customName) {
      const tab = this.tabs.get(tabId);
      if (tab) { tab.portName = customName; tab._updateHeader(); }
    }
  }

  // ── Theme & font ──────────────────────────────────────────────────────────
  _populateThemes() {
    const sel     = document.getElementById('select-theme');
    const current = this.settings.get('theme');
    Object.entries(THEMES).forEach(([key, t]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = t.name;
      if (key === current) opt.selected = true;
      sel.appendChild(opt);
    });
    this._applyTheme(current);
  }

  _applyTheme(key) {
    const theme = THEMES[key] ?? THEMES['default-dark'];
    this.tabs.forEach(t => t.setTheme(theme));
    document.body.classList.toggle('theme-chrome-light', !!theme.lightChrome);
  }

  _populateFontSize() {
    const sel  = document.getElementById('select-font-size');
    const size = String(this.settings.get('fontSize'));
    for (const opt of sel.options) {
      if (opt.value === size) { opt.selected = true; break; }
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  _fitAll() {
    requestAnimationFrame(() => {
      this.tabs.forEach(t => t.fit());
    });
  }

  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); this.addTab(); }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (this.activeId) this.removeTab(this.activeId); }
      if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); this._toggleMosaic(); }
      if (e.ctrlKey && e.key === 'Tab')  { e.preventDefault(); this._cycleTab(1); }
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') { e.preventDefault(); this._cycleTab(-1); }
      // Ctrl+1..4 to switch tab
      if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        const ids = [...this.tabs.keys()];
        if (ids[idx] !== undefined) { e.preventDefault(); this.setActive(ids[idx]); }
      }
    });
  }

  _cycleTab(dir) {
    const ids = [...this.tabs.keys()];
    const idx = ids.indexOf(this.activeId);
    const next = ids[(idx + dir + ids.length) % ids.length];
    if (next !== undefined) this.setActive(next);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
if (!('serial' in navigator)) {
  document.getElementById('no-serial-api').style.display = 'flex';
} else {
  new App().init();
}
