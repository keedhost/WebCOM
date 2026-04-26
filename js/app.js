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

// ─── Mosaic layout initial sizes (cols/rows fractions, sum = 1) ──────────────
const LAYOUT_INIT_SIZES = {
  h2:   { cols: [.5, .5],              rows: [1] },
  v2:   { cols: [1],                    rows: [.5, .5] },
  h3:   { cols: [1/3, 1/3, 1/3],       rows: [1] },
  v3:   { cols: [1],                    rows: [1/3, 1/3, 1/3] },
  '1v2':{ cols: [.5, .5],              rows: [.5, .5] },
  '1h2':{ cols: [.5, .5],              rows: [.5, .5] },
  '2x2':{ cols: [.5, .5],              rows: [.5, .5] },
  h4:   { cols: [.25, .25, .25, .25],  rows: [1] },
  v4:   { cols: [1],                    rows: [.25, .25, .25, .25] },
};

// ─── Mosaic layout definitions ───────────────────────────────────────────────
const MOSAIC_LAYOUTS = {
  2: [
    { id: 'h2',  label: '1 × 2',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="27" height="38" rx="2" fill="currentColor"/><rect x="32" y="1" width="27" height="38" rx="2" fill="currentColor"/></svg>` },
    { id: 'v2',  label: '2 × 1',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="17" rx="2" fill="currentColor"/><rect x="1" y="22" width="58" height="17" rx="2" fill="currentColor"/></svg>` },
  ],
  3: [
    { id: 'h3',  label: '1 × 3',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="17" height="38" rx="2" fill="currentColor"/><rect x="22" y="1" width="17" height="38" rx="2" fill="currentColor"/><rect x="43" y="1" width="16" height="38" rx="2" fill="currentColor"/></svg>` },
    { id: 'v3',  label: '3 × 1',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="10" rx="2" fill="currentColor"/><rect x="1" y="15" width="58" height="10" rx="2" fill="currentColor"/><rect x="1" y="29" width="58" height="10" rx="2" fill="currentColor"/></svg>` },
    { id: '1v2', label: '▌ + 2',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="27" height="38" rx="2" fill="currentColor"/><rect x="32" y="1" width="27" height="17" rx="2" fill="currentColor"/><rect x="32" y="22" width="27" height="17" rx="2" fill="currentColor"/></svg>` },
    { id: '1h2', label: '▀ + 2',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="17" rx="2" fill="currentColor"/><rect x="1" y="22" width="27" height="17" rx="2" fill="currentColor"/><rect x="32" y="22" width="27" height="17" rx="2" fill="currentColor"/></svg>` },
  ],
  4: [
    { id: '2x2', label: '2 × 2',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="27" height="17" rx="2" fill="currentColor"/><rect x="32" y="1" width="27" height="17" rx="2" fill="currentColor"/><rect x="1" y="22" width="27" height="17" rx="2" fill="currentColor"/><rect x="32" y="22" width="27" height="17" rx="2" fill="currentColor"/></svg>` },
    { id: 'h4',  label: '1 × 4',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="12" height="38" rx="2" fill="currentColor"/><rect x="16" y="1" width="12" height="38" rx="2" fill="currentColor"/><rect x="31" y="1" width="12" height="38" rx="2" fill="currentColor"/><rect x="46" y="1" width="13" height="38" rx="2" fill="currentColor"/></svg>` },
    { id: 'v4',  label: '4 × 1',
      svg: `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="7" rx="2" fill="currentColor"/><rect x="1" y="11" width="58" height="7" rx="2" fill="currentColor"/><rect x="1" y="21" width="58" height="7" rx="2" fill="currentColor"/><rect x="1" y="31" width="58" height="7" rx="2" fill="currentColor"/></svg>` },
  ],
};

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
    const t = k => this.app.i18n.t(k);
    tile.innerHTML = `
      <div class="tile-header">
        <span class="tile-status-dot disconnected"></span>
        <span class="tile-port-name">${t('tile.disconnected')}</span>
        <div class="tile-actions">
          <button class="tile-btn tile-btn-connect" title="Вибрати порт та підключити">${t('tile.connect')}</button>
          <button class="tile-btn tile-btn-disconnect" title="Відключитись" style="display:none">${t('tile.disconnect')}</button>
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
        await this.app._connectOrConfigure(this.id, port);
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
    const te = k => this.app.i18n.t(k);
    input.placeholder = te('tile.escPlaceholder');
    input.title = 'Підтримується: \\xNN, \\e (ESC), \\r, \\n, \\t, \\0';
    const sendBtn = document.createElement('button');
    sendBtn.className = 'esc-send-btn';
    sendBtn.textContent = te('tile.escSend');
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

    this.fit();
  }

  _showWelcome() {
    if (!this.app.settings.get('showWelcome')) return;
    const t   = k => this.app.i18n.t(k);
    const d   = '\x1b[2m';
    const r   = '\x1b[0m';
    const sep = '\x1b[90m';
    const sub = '\x1b[38;5;39m';

    // Colorize shade block chars: ░▒▓█ → dark→medium→bright cyan gradient
    const cl = s => s
      .replace(/░/g, '\x1b[38;5;24m░')
      .replace(/▒/g, '\x1b[38;5;31m▒')
      .replace(/▓/g, '\x1b[38;5;39m▓')
      .replace(/█/g, '\x1b[38;5;51m█') + r;

    this.term.writeln('');
    this.term.writeln('');
    this.term.writeln(`   ${sub}╻ ╻┏━╸┏┓ ┏━╸┏━┓┏┳┓${r}`);
    this.term.writeln(`   ${sub}┃╻┃┣╸ ┣┻┓┃  ┃ ┃┃┃┃${r}`);
    this.term.writeln(`   ${sub}┗┻┛┗━╸┗━┛┗━╸┗━┛╹ ╹${r}`);
    this.term.writeln('');
    this.term.writeln(`   ${sub}╻ ╻┏━╸┏┓    ┏━┓┏━╸┏━┓╻┏━┓╻     ╺┳╸┏━╸┏━┓┏┳┓╻┏┓╻┏━┓╻${r}`);
    this.term.writeln(`   ${sub}┃╻┃┣╸ ┣┻┓   ┗━┓┣╸ ┣┳┛┃┣━┫┃      ┃ ┣╸ ┣┳┛┃┃┃┃┃┗┫┣━┫┃${r}`);
    this.term.writeln(`   ${sub}┗┻┛┗━╸┗━┛   ┗━┛┗━╸╹┗╸╹╹ ╹┗━╸    ╹ ┗━╸╹┗╸╹ ╹╹╹ ╹╹ ╹┗━╸${r}`);
    this.term.writeln(`   ${sep}──────────────────────────────────────${r}`);
    this.term.writeln('');
    this.term.writeln(`   ${d}${t('term.welcome2')}${r}`);
    this.term.writeln(`   ${d}${t('term.welcome3')}${r}`);
    this.term.writeln('');

    // ── About panel ── rows 18–28 (1-indexed from terminal top) ──────────
    const bdr  = '\x1b[38;5;244m';
    const lbl  = '\x1b[2;37m';
    const val  = '\x1b[97m';
    const W    = 54;
    const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '');
    const pad   = s => { const n = W - strip(s).length; return s + (n > 0 ? ' '.repeat(n) : ''); };
    const B     = s => `   ${bdr}║${r}${pad(s)}${bdr}║${r}`;
    const HR    = '══════════════════════════════════════════════════════';
    const MID   = `   ${bdr}╠${HR}╣${r}`;

    const lblAuthor  = t('about.author');
    const lblLicense = t('about.license');
    const lblW = Math.max(lblAuthor.length, lblLicense.length);

    // Buttons: label row = terminal row 24 (fixed labels, not translated)
    const BTNS = [
      { label: ' GitHub ',       url: 'https://github.com/keedhost/WebCOM'       },
      { label: ' Report a bug ', url: 'https://github.com/keedhost/WebCOM/issues'},
    ];

    // Column ranges (1-indexed): 3 indent + ║ + 2 leading spaces → col 7
    let _c = 7;
    const btnCols = BTNS.map(btn => {
      const bw = btn.label.length + 2;
      const range = { start: _c, end: _c + bw - 1 };
      _c += bw + 3;
      return range;
    });

    // Pseudo-3D: bright top+left border (lit), dark bottom+right border (shadow)
    const LIT = '\x1b[97m';           // bright white — lit side (top, left)
    const SHD = '\x1b[38;5;240m';    // dark gray    — shadow side (bottom, right)

    // inv = index of "pressed" button (-1 = none)
    const drawTop = (inv = -1) => BTNS.reduce((s, btn, i) => {
      const c = i === inv ? SHD : LIT;   // pressed → top border becomes dark
      return s + `${c}┌${'─'.repeat(btn.label.length)}┐${r}` +
        (i < BTNS.length - 1 ? '   ' : '');
    }, '  ');

    const drawMid = (inv = -1) => BTNS.reduce((s, btn, i) => {
      const cl = i === inv ? SHD : LIT;  // left  │ swaps on press
      const cr = i === inv ? LIT : SHD;  // right │ swaps on press
      const face = i === inv
        ? `\x1b[7m${btn.label}\x1b[27m`  // inverted label when pressed
        : `${val}${btn.label}${r}`;
      return s + `${cl}│${r}${face}${cr}│${r}` +
        (i < BTNS.length - 1 ? '   ' : '');
    }, '  ');

    const drawBot = (inv = -1) => BTNS.reduce((s, btn, i) => {
      const c = i === inv ? LIT : SHD;   // pressed → bottom border becomes bright
      return s + `${c}└${'─'.repeat(btn.label.length)}┘${r}` +
        (i < BTNS.length - 1 ? '   ' : '');
    }, '  ');

    this.term.writeln(`   ${bdr}╔${HR}╗${r}`);                                                                                    // 18
    this.term.writeln(B(`  ${lbl}${lblAuthor.padEnd(lblW)} :${r}  ${val}${t('about.authorName')}${r}`));                     // 19
    this.term.writeln(B(`  ${lbl}${lblLicense.padEnd(lblW)} :${r}  ${val}GNU General Public License v3${r}`));               // 20
    this.term.writeln(MID);                                                                    // 21
    this.term.writeln(B(''));                                                                  // 22
    this.term.writeln(B(drawTop()));                                                           // 23
    this.term.writeln(B(drawMid()));                                                           // 24 ← labels
    this.term.writeln(B(drawBot()));                                                           // 25
    this.term.writeln(B(''));                                                                  // 26
    this.term.writeln(`   ${bdr}╚${HR}╝${r}`);                                              // 27
    this.term.writeln('');                                                                     // 28

    // ── Click handler: pixel → cell → 3-row press animation ──────────────
    const _BTN_TOP_ROW = 23;
    const _BTN_MID_ROW = 24;
    const _BTN_BOT_ROW = 25;

    const _redraw3 = (hit) => {
      const base = this.term.buffer.active.baseY;
      const vT = _BTN_TOP_ROW - base;
      const vM = _BTN_MID_ROW - base;
      const vB = _BTN_BOT_ROW - base;
      if (vM < 1 || vM > this.term.rows) return false;
      this.term.write(
        `\x1b[s` +
        `\x1b[${vT};1H${B(drawTop(hit))}` +
        `\x1b[${vM};1H${B(drawMid(hit))}` +
        `\x1b[${vB};1H${B(drawBot(hit))}` +
        `\x1b[u`
      );
      return true;
    };

    const _onBtnClick = (e) => {
      if (this.connected) return;
      const screen = this.term.element.querySelector('.xterm-screen');
      if (!screen) return;
      const rect  = screen.getBoundingClientRect();
      const cellW = rect.width  / this.term.cols;
      const cellH = rect.height / this.term.rows;
      const col   = Math.floor((e.clientX - rect.left) / cellW) + 1;
      const row   = Math.floor((e.clientY - rect.top)  / cellH) + 1;
      if (row < 23 || row > 25) return;
      const hit = btnCols.findIndex(b => col >= b.start && col <= b.end);
      if (hit < 0) return;
      const visible = _redraw3(hit);           // draw pressed state
      setTimeout(() => {
        if (visible) _redraw3(-1);             // restore normal state
        window.open(BTNS[hit].url, '_blank', 'noopener,noreferrer');
      }, 150);
    };

    const _onBtnMove = (e) => {
      if (this.connected) { this.term.element.style.cursor = ''; return; }
      const screen = this.term.element.querySelector('.xterm-screen');
      if (!screen) return;
      const rect  = screen.getBoundingClientRect();
      const cellW = rect.width  / this.term.cols;
      const cellH = rect.height / this.term.rows;
      const col   = Math.floor((e.clientX - rect.left) / cellW) + 1;
      const row   = Math.floor((e.clientY - rect.top)  / cellH) + 1;
      const over  = row >= 23 && row <= 25 && btnCols.some(b => col >= b.start && col <= b.end);
      this.term.element.style.cursor = over ? 'pointer' : '';
    };

    if (this._onBtnClick)     this.term.element.removeEventListener('click',     this._onBtnClick);
    if (this._onBtnMove)      this.term.element.removeEventListener('mousemove', this._onBtnMove);
    this._onBtnClick = _onBtnClick;
    this._onBtnMove  = _onBtnMove;
    this.term.element.addEventListener('click',     this._onBtnClick);
    this.term.element.addEventListener('mousemove', this._onBtnMove);
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
      const t = k => this.app.i18n.t(k);
      this.term.writeln(`\x1b[32m${t('term.connected')} (${config.baudRate} baud ${config.dataBits}${config.parity[0].toUpperCase()}${config.stopBits})\x1b[0m`);
      this.term.focus();

      // Wire disconnect event (USB unplug etc.)
      port.addEventListener('disconnect', () => this._onUnexpectedDisconnect());

      this._readLoopRunning = true;
      this._readLoopDone = this._readLoop();
    } catch (err) {
      const te = k => this.app.i18n.t(k);
      if (err.name === 'NotFoundError') {
        this.term.writeln(`\x1b[33m${te('term.cancelled')}\x1b[0m`);
      } else {
        this.term.writeln(`\x1b[31m${te('term.errorConnect')}${err.message}\x1b[0m`);
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
        this.term.writeln(`\x1b[31m\r\n${this.app.i18n.t('term.errorRead')}${err.message}\x1b[0m`);
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
    this.term.writeln(`\r\n\x1b[33m${this.app.i18n.t('term.disconnected')}\x1b[0m`);

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
    this.term.writeln(`\r\n\x1b[31m${this.app.i18n.t('term.deviceUnplugged')}\x1b[0m`);
    this._setStatus('error');
    this._updateHeader();
  }

  async sendData(data) {
    if (!this.connected || !this.writer) return;
    try {
      await this.writer.write(new TextEncoder().encode(data));
    } catch (err) {
      this.term.writeln(`\r\n\x1b[31m${this.app.i18n.t('term.errorWrite')}${err.message}\x1b[0m`);
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
    const t    = k => this.app.i18n.t(k);
    const btnC  = this.tileEl.querySelector('.tile-btn-connect');
    const btnD  = this.tileEl.querySelector('.tile-btn-disconnect');
    const label = this.tileEl.querySelector('.tile-port-name');
    const tabLbl = this.tabEl.querySelector('.tab-label');

    if (this.connected) {
      btnC.style.display = 'none';
      btnD.style.display = '';
      label.textContent  = this.portName ?? t('tile.disconnected');
      tabLbl.textContent = this.portName ?? `T${this.id}`;
      this._setStatus('connected');
    } else {
      btnC.style.display = '';
      btnD.style.display = 'none';
      label.textContent  = t('tile.disconnected');
      tabLbl.textContent = `${t('tab.label')} ${this.id}`;
      if (!this.tileEl.querySelector('.tile-status-dot.error')) {
        this._setStatus('disconnected');
      }
    }
  }

  refreshI18n() {
    const t = k => this.app.i18n.t(k);
    const btnC    = this.tileEl.querySelector('.tile-btn-connect');
    const btnD    = this.tileEl.querySelector('.tile-btn-disconnect');
    const sendBtn = this.tileEl.querySelector('.esc-send-btn');
    const escInp  = this.tileEl.querySelector('.esc-custom-input');
    if (btnC)    btnC.textContent    = t('tile.connect');
    if (btnD)    btnD.textContent    = t('tile.disconnect');
    if (sendBtn) sendBtn.textContent = t('tile.escSend');
    if (escInp)  escInp.placeholder  = t('tile.escPlaceholder');
    this._updateHeader();
    if (!this.connected) {
      this.term.clear();
      this._showWelcome();
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
    this.settings  = new Settings();
    this.i18n      = new I18n(this.settings);
    this.tabs      = new Map();   // id -> TerminalTab
    this.nextId    = 1;
    this.activeId  = null;
    this.mosaic    = false;
    this.cmdPanel  = null;
    this._pendingTabId    = null;
    this._pendingPort     = null; // SerialPort selected before settings modal
    this._connectOnOpen   = true;
  }

  init() {
    this._bindStaticUI();
    this._populateThemes();
    this._populateFontSize();
    this._bindLangSwitcher();
    this.i18n._applyToDOM();
    this._syncLangButtons();
    const INIT_FLAGS = {
      uk: '<span class="fi fi-ua lang-flag"></span>',
      en: '<span class="fi fi-gb lang-flag"></span>',
      fr: '<span class="fi fi-fr lang-flag"></span>',
      de: '<span class="fi fi-de lang-flag"></span>',
      pl: '<span class="fi fi-pl lang-flag"></span>',
      cs: '<span class="fi fi-cz lang-flag"></span>',
      es: '<span class="fi fi-es lang-flag"></span>',
      pt: '<span class="fi fi-pt lang-flag"></span>',
    };
    document.getElementById('btn-lang-current').innerHTML = INIT_FLAGS[this.i18n.lang] ?? '🌐';
    this.addTab();
    this._bindPrefsModal();
    this._bindKeyboard();
    this.cmdPanel = new CmdPanel(this);
    this._showLinuxNotice();
    window.addEventListener('resize', () => this._fitAll());
  }

  // ── Static UI wiring ──────────────────────────────────────────────────────
  _bindStaticUI() {
    document.getElementById('btn-add-tab').addEventListener('click', () => this.addTab());
    document.getElementById('btn-cmd-panel').addEventListener('click', () => this.cmdPanel?.toggle());
    document.getElementById('btn-mosaic').addEventListener('click', () => this._toggleMosaic());
    document.getElementById('btn-connect-port').addEventListener('click', async () => {
      if (!this.activeId) return;
      try {
        const port = await navigator.serial.requestPort();
        await this._connectOrConfigure(this.activeId, port);
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
    document.querySelector('#modal-settings .modal-backdrop').addEventListener('click', () => this._closeModal());
    document.getElementById('btn-prefs').addEventListener('click', () => this._openPrefs());

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
    this.setActive(id);   // calls fit() → terminal gets real dimensions
    requestAnimationFrame(() => tab._showWelcome());
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
    this._showMosaicPicker();
  }

  _deactivateMosaic() {
    this.mosaic = false;
    const container = document.getElementById('terminals-container');
    container.classList.remove('mosaic');
    container.removeAttribute('data-layout');
    container.style.gridTemplateColumns = '';
    container.style.gridTemplateRows    = '';
    document.getElementById('mosaic-resize-overlay')?.remove();
    const btn = document.getElementById('btn-mosaic');
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    this._closeMosaicPicker();
    this._fitAll();
  }

  _showMosaicPicker() {
    const n = this.tabs.size;
    const layouts = MOSAIC_LAYOUTS[Math.min(n, 4)] ?? [];
    if (!layouts.length) return;

    let picker = document.getElementById('mosaic-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'mosaic-picker';
      picker.className = 'mosaic-picker hidden';
      document.body.appendChild(picker);
      document.addEventListener('click', (e) => {
        const btn = document.getElementById('btn-mosaic');
        if (!picker.contains(e.target) && !btn.contains(e.target)) {
          this._closeMosaicPicker();
        }
      });
    }

    const activeLay = document.getElementById('terminals-container').dataset.layout ?? '';
    const resetSvg = `<svg viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="38" rx="2" fill="currentColor"/></svg>`;
    picker.innerHTML = `<div class="mosaic-picker-title">Layout</div>
      <div class="mosaic-picker-cards">${
        layouts.map(l => `<button class="mosaic-card${activeLay === l.id ? ' active' : ''}" data-layout="${l.id}" title="${l.label}">
          ${l.svg}
          <span class="mosaic-card-label">${l.label}</span>
        </button>`).join('')
      }</div>
      <div class="mosaic-picker-sep"></div>
      <button class="mosaic-card mosaic-card-reset" title="Default (single tab)">
        ${resetSvg}
        <span class="mosaic-card-label">Default</span>
      </button>`;

    picker.querySelectorAll('.mosaic-card:not(.mosaic-card-reset)').forEach(card => {
      card.addEventListener('click', () => this._applyLayout(card.dataset.layout));
    });
    picker.querySelector('.mosaic-card-reset').addEventListener('click', () => this._deactivateMosaic());

    const btn = document.getElementById('btn-mosaic');
    const rect = btn.getBoundingClientRect();
    picker.style.top   = (rect.bottom + 6) + 'px';
    picker.style.right = (window.innerWidth - rect.right + rect.width / 2 - 18) + 'px';

    picker.classList.remove('hidden');
  }

  _closeMosaicPicker() {
    document.getElementById('mosaic-picker')?.classList.add('hidden');
  }

  _applyLayout(id) {
    const container = document.getElementById('terminals-container');
    this.mosaic = true;
    container.classList.add('mosaic');
    container.dataset.layout = id;
    const btn = document.getElementById('btn-mosaic');
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    this._closeMosaicPicker();
    this._buildResizeHandles(id);
    this._fitAll();
  }

  // ── Resize handles ────────────────────────────────────────────────────────

  _buildResizeHandles(layoutId) {
    const container = document.getElementById('terminals-container');
    document.getElementById('mosaic-resize-overlay')?.remove();
    container.style.gridTemplateColumns = '';
    container.style.gridTemplateRows    = '';

    const def = LAYOUT_INIT_SIZES[layoutId];
    if (!def) return;

    this._colSizes = [...def.cols];
    this._rowSizes = [...def.rows];

    const overlay = document.createElement('div');
    overlay.id = 'mosaic-resize-overlay';
    overlay.className = 'mosaic-resize-overlay';
    container.appendChild(overlay);

    const addHandle = (type, idx) => {
      const h = document.createElement('div');
      h.className = `resize-handle resize-handle-${type}`;
      h.dataset.type = type;
      h.dataset.idx  = String(idx);
      this._positionHandle(h);
      h.addEventListener('mousedown', e => { e.preventDefault(); this._startResize(e, type, idx); });
      overlay.appendChild(h);
    };

    for (let i = 0; i < this._colSizes.length - 1; i++) addHandle('col', i);
    for (let i = 0; i < this._rowSizes.length - 1; i++) addHandle('row', i);

    this._applyGridSizes(container);
  }

  _applyGridSizes(container) {
    const fr = arr => arr.map(v => `${(v * 100).toFixed(3)}fr`).join(' ');
    container.style.gridTemplateColumns = fr(this._colSizes);
    container.style.gridTemplateRows    = fr(this._rowSizes);
  }

  _positionHandle(h) {
    const type = h.dataset.type;
    const idx  = parseInt(h.dataset.idx);
    const sizes = type === 'col' ? this._colSizes : this._rowSizes;
    const pct = sizes.slice(0, idx + 1).reduce((a, b) => a + b, 0) * 100;
    if (type === 'col') h.style.left = pct + '%';
    else                h.style.top  = pct + '%';
  }

  _startResize(e, type, idx) {
    const container = document.getElementById('terminals-container');
    const rect = container.getBoundingClientRect();
    const sizes = type === 'col' ? this._colSizes : this._rowSizes;
    const before = sizes.slice(0, idx).reduce((a, b) => a + b, 0);
    const after  = sizes.slice(idx + 2).reduce((a, b) => a + b, 0);
    const avail  = 1 - before - after;
    const MIN    = 0.08;

    document.querySelectorAll(`.resize-handle-${type}[data-idx="${idx}"]`)
      .forEach(h => h.classList.add('dragging'));

    let rafId = null;
    const onMove = ev => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const total = type === 'col' ? rect.width : rect.height;
        const pos   = (type === 'col' ? ev.clientX - rect.left : ev.clientY - rect.top);
        let newA = pos / total - before;
        newA = Math.max(MIN, Math.min(avail - MIN, newA));
        sizes[idx]     = newA;
        sizes[idx + 1] = avail - newA;
        this._applyGridSizes(container);
        document.querySelectorAll('.resize-handle').forEach(h => this._positionHandle(h));
        this._fitAll();
      });
    };

    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.querySelectorAll('.resize-handle').forEach(h => h.classList.remove('dragging'));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  _updateContainerCount() {
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
    const t = k => this.i18n.t(k);
    btn.innerHTML   = connectOnOpen
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg> ${t('modal.btn.connect')}`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> ${t('modal.btn.save')}`;

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

  // ── _connectOrConfigure ───────────────────────────────────────────────────
  async _connectOrConfigure(tabId, port) {
    if (this.settings.get('skipPortSettings')) {
      const tab = this.tabs.get(tabId);
      if (tab) await tab.connect(port, this.settings.portConfig());
    } else {
      this.openSettingsModal(tabId, true, port);
    }
  }

  // ── Prefs modal ───────────────────────────────────────────────────────────
  _bindPrefsModal() {
    document.getElementById('btn-close-prefs').addEventListener('click', () => this._closePrefs());
    document.getElementById('prefs-backdrop').addEventListener('click',  () => this._closePrefs());

    document.getElementById('prefs-theme').addEventListener('change', e => {
      this.settings.set('theme', e.target.value);
      document.getElementById('select-theme').value = e.target.value;
      this._applyTheme(e.target.value);
    });

    document.getElementById('prefs-font-size').addEventListener('change', e => {
      const size = Number(e.target.value);
      this.settings.set('fontSize', size);
      document.getElementById('select-font-size').value = e.target.value;
      this.tabs.forEach(t => t.setFontSize(size));
    });

    document.getElementById('prefs-show-welcome').addEventListener('change', e => {
      this.settings.set('showWelcome', e.target.checked);
    });

    document.getElementById('prefs-skip-settings').addEventListener('change', e => {
      this.settings.set('skipPortSettings', e.target.checked);
    });

    const portFields = ['prefs-baud','prefs-databits','prefs-parity','prefs-stopbits','prefs-flow'];
    const portKeys   = ['baudRate',  'dataBits',      'parity',      'stopBits',      'flowControl'];
    portFields.forEach((id, i) => {
      document.getElementById(id).addEventListener('change', e => {
        const v = portKeys[i] === 'baudRate' || portKeys[i] === 'dataBits' || portKeys[i] === 'stopBits'
          ? Number(e.target.value) : e.target.value;
        this.settings.set(portKeys[i], v);
        // keep port settings modal in sync
        const mirrorId = { 'prefs-baud':'cfg-baud','prefs-databits':'cfg-databits',
          'prefs-parity':'cfg-parity','prefs-stopbits':'cfg-stopbits','prefs-flow':'cfg-flow' }[id];
        if (mirrorId) document.getElementById(mirrorId).value = e.target.value;
      });
    });

    document.getElementById('prefs-lang').addEventListener('change', e => {
      const lang = e.target.value;
      this.i18n.setLang(lang);
      const FLAGS = { uk:'<span class="fi fi-ua lang-flag"></span>', en:'<span class="fi fi-gb lang-flag"></span>',
        fr:'<span class="fi fi-fr lang-flag"></span>', de:'<span class="fi fi-de lang-flag"></span>',
        pl:'<span class="fi fi-pl lang-flag"></span>', cs:'<span class="fi fi-cz lang-flag"></span>',
        es:'<span class="fi fi-es lang-flag"></span>', pt:'<span class="fi fi-pt lang-flag"></span>' };
      document.getElementById('btn-lang-current').innerHTML = FLAGS[lang] ?? '🌐';
      this._syncLangButtons();
      this.tabs.forEach(t => t.refreshI18n());
    });

    document.getElementById('prefs-export').addEventListener('click', () => this._exportSettings());
    document.getElementById('prefs-import-file').addEventListener('change', e => {
      if (e.target.files[0]) this._importSettings(e.target.files[0]);
      e.target.value = '';
    });

  }

  _openPrefs() {
    const s = this.settings;

    // Populate theme options lazily (only once)
    const prefThemeSel = document.getElementById('prefs-theme');
    if (prefThemeSel.options.length === 0) {
      Object.entries(THEMES).forEach(([key, theme]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = theme.name;
        prefThemeSel.appendChild(opt);
      });
    }

    prefThemeSel.value                                    = s.get('theme');
    document.getElementById('prefs-font-size').value   = s.get('fontSize');
    document.getElementById('prefs-show-welcome').checked  = s.get('showWelcome');
    document.getElementById('prefs-skip-settings').checked = s.get('skipPortSettings');
    document.getElementById('prefs-baud').value        = s.get('baudRate');
    document.getElementById('prefs-databits').value    = s.get('dataBits');
    document.getElementById('prefs-parity').value      = s.get('parity');
    document.getElementById('prefs-stopbits').value    = s.get('stopBits');
    document.getElementById('prefs-flow').value        = s.get('flowControl');
    document.getElementById('prefs-lang').value        = this.i18n.lang;
    document.getElementById('modal-prefs').classList.remove('hidden');
  }

  _closePrefs() {
    document.getElementById('modal-prefs').classList.add('hidden');
  }

  _exportSettings() {
    const payload = {
      _info: {
        app: 'WebCOM — Web Serial Terminal',
        url: 'https://keedhost.github.io/WebCOM/',
        source: 'https://github.com/keedhost/WebCOM',
        description: 'WebCOM settings file. Import it via Settings → Data → Import.',
        exported: new Date().toISOString(),
      },
      ...this.settings._d,
    };
    const json = JSON.stringify(payload, null, 2);
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      download: 'webcom-settings.json',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  _importSettings(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error();
        const { _info, ...settings } = data;
        this.settings.setMany(settings);
        window.location.reload();
      } catch {
        alert('Invalid settings file');
      }
    };
    reader.readAsText(file);
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
      if (e.ctrlKey && e.key === '`') { e.preventDefault(); this.cmdPanel?.toggle(); }
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

  _bindLangSwitcher() {
    const FLAGS = {
      uk: '<span class="fi fi-ua lang-flag"></span>',
      en: '<span class="fi fi-gb lang-flag"></span>',
      fr: '<span class="fi fi-fr lang-flag"></span>',
      de: '<span class="fi fi-de lang-flag"></span>',
      pl: '<span class="fi fi-pl lang-flag"></span>',
      cs: '<span class="fi fi-cz lang-flag"></span>',
      es: '<span class="fi fi-es lang-flag"></span>',
      pt: '<span class="fi fi-pt lang-flag"></span>',
    };
    const btn      = document.getElementById('btn-lang-current');
    const dropdown = document.getElementById('lang-dropdown');

    const open = () => {
      dropdown.classList.remove('hidden');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      dropdown.classList.add('hidden');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.contains('hidden') ? open() : close();
    });

    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', () => {
        this.i18n.setLang(opt.dataset.lang);
        btn.innerHTML = FLAGS[opt.dataset.lang] ?? '🌐';
        this._syncLangButtons();
        this.tabs.forEach(t => t.refreshI18n());
        close();
      });
    });

    // Close on outside click
    document.addEventListener('click', () => close());
    dropdown.addEventListener('click', e => e.stopPropagation());
  }

  _syncLangButtons() {
    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === this.i18n.lang);
    });
  }

  _showLinuxNotice() {
    const STORAGE_KEY = 'webcom_linux_dialout_dismissed';
    const platform = navigator.userAgentData?.platform ?? navigator.platform ?? '';
    if (!/linux/i.test(platform) || localStorage.getItem(STORAGE_KEY)) return;

    const notice = document.getElementById('linux-notice');
    notice.classList.remove('hidden');
    this._fitAll();

    document.getElementById('btn-linux-notice-close').addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, '1');
      notice.classList.add('hidden');
      this._fitAll();
    });
  }

  findTabByPort(port) {
    for (const [, tab] of this.tabs) {
      if (tab.port === port) return tab;
    }
    return null;
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
      