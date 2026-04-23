// ─── Command Panel ───────────────────────────────────────────────────────────

const CMD_HELP = [
  {
    section: 'Пристрої',
    cmds: [
      {
        name: 'list',
        desc: 'Показати всі доступні серійні порти',
        examples: ['list'],
      },
      {
        name: 'status',
        desc: 'Статус портів: вільний / зайнятий, тип пристрою',
        examples: ['status', 'status ttyUSB0'],
      },
      {
        name: 'info <port>',
        desc: 'Детальна інформація про порт (VID, PID, виробник)',
        examples: ['info ttyUSB0', 'info COM3'],
      },
    ],
  },
  {
    section: 'Підключення',
    cmds: [
      {
        name: 'connect <port> [baud]',
        desc: 'Підключитись до порту. На Unix — за назвою файлу (/dev/tty…), на Windows — за назвою (COM1…)',
        examples: ['connect ttyUSB0', 'connect /dev/ttyACM0 115200', 'connect COM3 9600'],
      },
      {
        name: 'disconnect [tab]',
        desc: 'Відключитись від поточного або вказаного термінала',
        examples: ['disconnect', 'disconnect 2'],
      },
      {
        name: 'minicom <port> [options]',
        desc: 'Підключення з параметрами у стилі minicom',
        examples: [
          'minicom -b 115200 -D /dev/ttyUSB0',
          'minicom -b 9600 -D COM3 -8',
          'minicom -b 115200 -D /dev/ttyACM0 --noinit',
        ],
      },
    ],
  },
  {
    section: 'Термінал',
    cmds: [
      {
        name: 'tabs',
        desc: 'Показати всі відкриті термінали та їх стан',
        examples: ['tabs'],
      },
      {
        name: 'clear',
        desc: 'Очистити вивід командної панелі',
        examples: ['clear'],
      },
      {
        name: 'help [cmd]',
        desc: 'Список команд або довідка по конкретній команді',
        examples: ['help', 'help minicom'],
      },
    ],
  },
];

// minicom flag → Web Serial config mapping
const MINICOM_FLAGS = {
  '-b': 'baudRate',
  '--baud': 'baudRate',
  '-D': 'device',
  '--device': 'device',
  '-8': { dataBits: 8 },
  '-7': { dataBits: 7 },
  '--noinit': null,          // ignored — no init string in WebSerial
  '--noexit': null,
  '--color=on': null,
  '--color=off': null,
};

// Normalize an OS port name to a canonical display form:
//   "ttyUSB0"  → "/dev/ttyUSB0"   (Linux bare name)
//   "COM3"     → "COM3"            (Windows, keep as-is)
//   "/dev/..." → "/dev/..."        (already absolute)
function _resolveOsPortName(raw) {
  if (!raw) return raw;
  if (/^COM\d+$/i.test(raw)) return raw.toUpperCase();
  if (raw.startsWith('/dev/') || raw.startsWith('\\\\.\\')) return raw;
  if (/^tty|^serial|^cu\./i.test(raw)) return '/dev/' + raw;
  return raw;
}

class CmdPanel {
  constructor(app) {
    this.app      = app;
    this._history = [];
    this._histIdx         = -1;
    this._visible         = false;
    this._panelH          = null; // null = use CSS default (33vh)
    this._linuxNoteShown  = false;

    this._panel  = document.getElementById('cmd-panel');
    this._output = document.getElementById('cmd-output');
    this._input  = document.getElementById('cmd-input');
    this._btn    = document.getElementById('btn-cmd-panel');

    this._buildHelp();
    this._bindEvents();
  }

  // ── Visibility ────────────────────────────────────────────────────────────
  toggle() {
    this._visible = !this._visible;
    this._panel.classList.toggle('hidden', !this._visible);
    this._btn.classList.toggle('active', this._visible);
    this._btn.setAttribute('aria-pressed', this._visible);
    if (this._visible) {
      if (CmdPanel._isLinux() && !this._linuxNoteShown
          && !localStorage.getItem('webcom_linux_dialout_dismissed')) {
        this._linuxNoteShown = true;
        this._appendLinuxDialoutNote();
      }
      this._input.focus();
      this._scrollOutput();
    }
    this.app._fitAll();
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    // Run button
    document.getElementById('cmd-run-btn').addEventListener('click', () => this._run());

    // Keyboard in input
    this._input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._run(); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this._histStep(1); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._histStep(-1); return; }
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); this._execClear(); return; }
    });

    // Resize handle drag
    const handle = document.getElementById('cmd-resize-handle');
    let startY = 0, startH = 0;

    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      startY = e.clientY;
      startH = this._panel.offsetHeight;
      handle.classList.add('dragging');

      const onMove = ev => {
        const delta = startY - ev.clientY;
        const newH  = Math.min(Math.max(startH + delta, 80), window.innerHeight * 0.85);
        this._panel.style.height = newH + 'px';
        this._panelH = newH;
        this.app._fitAll();
      };
      const onUp = () => {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Click on examples in help → fill input
    document.getElementById('cmd-help-content').addEventListener('click', e => {
      const ex = e.target.closest('.help-cmd-ex');
      if (ex) {
        this._input.value = ex.dataset.cmd;
        this._input.focus();
      }
    });
  }

  // ── History ───────────────────────────────────────────────────────────────
  _histStep(dir) {
    if (!this._history.length) return;
    this._histIdx = Math.max(-1, Math.min(this._history.length - 1, this._histIdx + dir));
    this._input.value = this._histIdx >= 0 ? this._history[this._history.length - 1 - this._histIdx] : '';
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async _run() {
    const raw = this._input.value.trim();
    if (!raw) return;

    this._history.push(raw);
    this._histIdx = -1;
    this._input.value = '';
    this._appendInput(raw);

    const [cmd, ...args] = raw.split(/\s+/);
    try {
      await this._dispatch(cmd.toLowerCase(), args, raw);
    } catch (err) {
      this._appendLine(`Помилка: ${err.message}`, 'err');
    }
    this._scrollOutput();
  }

  async _dispatch(cmd, args, raw) {
    switch (cmd) {
      case 'list':       return this._execList();
      case 'status':     return this._execStatus(args);
      case 'info':       return this._execInfo(args);
      case 'connect':    return this._execConnect(args);
      case 'disconnect': return this._execDisconnect(args);
      case 'minicom':    return this._execMinicom(args);
      case 'tabs':       return this._execTabs();
      case 'clear':      return this._execClear();
      case 'help':       return this._execHelp(args);
      default:
        this._appendLine(`Невідома команда: ${cmd}. Введіть help для списку.`, 'err');
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  async _execList() {
    this._appendLine('Запит дозволу на перегляд портів…', 'info');
    let ports;
    try {
      ports = await navigator.serial.getPorts();
    } catch (e) {
      this._appendLine(`Не вдалося отримати список: ${e.message}`, 'err');
      return;
    }

    if (!ports.length) {
      this._appendLine('Немає портів з наданим дозволом. Використайте кнопку «Підключити порт» для надання доступу.', 'warn');
    } else {
      this._appendLine(`Знайдено ${ports.length} порт(ів):`, 'head');
      const rows = ports.map((p, i) => {
        const name = this._portName(p, i);
        const info = p.getInfo?.() ?? {};
        const type = this._guessType(info);
        return { name, type };
      });
      this._appendTable(['Порт', 'Тип'], rows.map(r => [
        { text: r.name, cls: 'cmd-cell-name' },
        { text: r.type },
      ]));
    }

  }

  async _execStatus(args) {
    let ports;
    try { ports = await navigator.serial.getPorts(); } catch (e) {
      this._appendLine(`Помилка: ${e.message}`, 'err'); return;
    }

    if (!ports.length) {
      this._appendLine('Немає портів з наданим дозволом.', 'warn'); return;
    }

    const filterName = args[0]?.replace(/^\/dev\//, '');

    this._appendLine('Статус портів:', 'head');
    const rows = [];
    for (let i = 0; i < ports.length; i++) {
      const p    = ports[i];
      const name = this._portName(p, i);
      if (filterName && !name.includes(filterName)) continue;

      const isOpen   = p.readable !== null;
      const tab      = this._tabForPort(p);
      const status   = isOpen
        ? (tab ? `зайнятий (термінал ${tab.id})` : 'відкрито (невідомо)')
        : 'вільний';
      const statusCls = isOpen ? 'cmd-cell-busy' : 'cmd-cell-free';

      const info = p.getInfo?.() ?? {};
      const type = this._guessType(info);

      rows.push([
        { text: name, cls: 'cmd-cell-name' },
        { text: status, cls: statusCls },
        { text: type },
      ]);
    }

    if (!rows.length) {
      this._appendLine(`Порт "${args[0]}" не знайдено в списку дозволених.`, 'warn');
    } else {
      this._appendTable(['Порт', 'Статус', 'Тип'], rows);
    }
  }

  async _execInfo(args) {
    if (!args.length) { this._appendLine('Вкажіть назву порту: info <port>', 'warn'); return; }
    const target = args[0].replace(/^\/dev\//, '');

    let ports;
    try { ports = await navigator.serial.getPorts(); } catch (e) {
      this._appendLine(`Помилка: ${e.message}`, 'err'); return;
    }

    const found = ports.find((p, i) => this._portName(p, i).includes(target));
    if (!found) {
      this._appendLine(`Порт "${args[0]}" не знайдено серед дозволених.`, 'warn'); return;
    }

    const info = found.getInfo?.() ?? {};
    const osName = (typeof info.portName === 'string' && info.portName.trim())
      ? _resolveOsPortName(info.portName.trim())
      : '—';
    const rows = [
      [{ text: 'Системна назва', cls: 'cmd-cell-muted' }, { text: osName }],
      [{ text: 'Тип',            cls: 'cmd-cell-muted' }, { text: this._guessType(info) }],
      [{ text: 'VID',            cls: 'cmd-cell-muted' }, { text: info.usbVendorId  != null ? '0x' + info.usbVendorId.toString(16).padStart(4,'0').toUpperCase()  : '—' }],
      [{ text: 'PID',            cls: 'cmd-cell-muted' }, { text: info.usbProductId != null ? '0x' + info.usbProductId.toString(16).padStart(4,'0').toUpperCase() : '—' }],
      [{ text: 'Стан',           cls: 'cmd-cell-muted' }, { text: found.readable !== null ? 'відкрито' : 'закрито' }],
    ];
    this._appendTable(['Поле', 'Значення'], rows);
  }

  async _execConnect(args) {
    if (!args.length) { this._appendLine('Вкажіть порт: connect <port> [baud]', 'warn'); return; }
    const portArg = args[0];
    const baud    = args[1] ? parseInt(args[1], 10) : this.app.settings.get('baudRate');

    if (isNaN(baud)) { this._appendLine(`Невірний baud rate: ${args[1]}`, 'err'); return; }

    // Find in already-granted ports
    let ports;
    try { ports = await navigator.serial.getPorts(); } catch (e) {
      this._appendLine(`Помилка: ${e.message}`, 'err'); return;
    }

    const cleanArg = portArg.replace(/^\/dev\//, '');
    const found = ports.find((p, i) => this._portName(p, i).replace(/^\/dev\//, '') === cleanArg
                                    || this._portName(p, i).includes(cleanArg));

    if (!found) {
      this._appendLine(`Порт "${portArg}" не знайдено серед дозволених. Спочатку надайте доступ через «Підключити порт».`, 'warn');
      return;
    }

    const tab = this.app.tabs.get(this.app.activeId);
    if (!tab) { this._appendLine('Немає активного термінала.', 'err'); return; }

    const existingTab = this.app.findTabByPort(found);
    if (existingTab && existingTab.id !== tab.id) {
      this._appendLine(`Порт вже відкрито в терміналі ${existingTab.id}.`, 'warn'); return;
    }

    const config = { ...this._defaultConfig(), baudRate: baud };
    this._appendLine(`Підключення до ${portArg} (${baud} baud)…`, 'info');
    await tab.connect(found, config);
    if (tab.connected) {
      this._appendLine(`✓ Підключено до ${portArg}`, 'ok');
    }
  }

  async _execDisconnect(args) {
    const id  = args[0] ? parseInt(args[0], 10) : this.app.activeId;
    const tab = this.app.tabs.get(id);
    if (!tab) { this._appendLine(`Термінал ${id} не знайдено.`, 'err'); return; }
    if (!tab.connected) { this._appendLine(`Термінал ${id} вже відключено.`, 'warn'); return; }
    await tab.disconnect();
    this._appendLine(`● Термінал ${id} відключено.`, 'ok');
  }

  async _execMinicom(args) {
    // Parse minicom-style flags:  minicom -b 115200 -D /dev/ttyUSB0 [-8] [--noinit]
    let device = null, baud = null;
    const extra = {};

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-b' || a === '--baud')   { baud   = parseInt(args[++i], 10); continue; }
      if (a === '-D' || a === '--device') { device = args[++i]; continue; }
      if (a === '-8') { extra.dataBits = 8; continue; }
      if (a === '-7') { extra.dataBits = 7; continue; }
      if (a === '--noinit' || a === '--noexit' || a.startsWith('--color')) continue;
      // Positional: treat as device if no -D given
      if (!a.startsWith('-') && !device) { device = a; }
    }

    if (!device) {
      this._appendLine('Вкажіть пристрій: minicom -b <baud> -D <port>', 'warn'); return;
    }

    const connectArgs = [device];
    if (baud) connectArgs.push(String(baud));
    if (extra.dataBits) this.app.settings.set('dataBits', extra.dataBits);

    await this._execConnect(connectArgs);
  }

  _execTabs() {
    if (!this.app.tabs.size) { this._appendLine('Немає відкритих терміналів.', 'warn'); return; }
    this._appendLine('Термінали:', 'head');
    const rows = [];
    this.app.tabs.forEach((tab, id) => {
      const active = id === this.app.activeId ? '●' : '○';
      const state  = tab.connected ? 'підключено' : 'не підключено';
      const cls    = tab.connected ? 'cmd-cell-free' : 'cmd-cell-muted';
      rows.push([
        { text: active + ' ' + id },
        { text: tab.portName ?? '—' },
        { text: state, cls },
      ]);
    });
    this._appendTable(['#', 'Порт', 'Стан'], rows);
  }

  _execClear() {
    this._output.innerHTML = '';
  }

  _execHelp(args) {
    if (args.length) {
      const name = args[0].toLowerCase();
      for (const sec of CMD_HELP) {
        const c = sec.cmds.find(c => c.name.split(' ')[0] === name);
        if (c) {
          this._appendLine(c.name, 'head');
          this._appendLine(c.desc, 'info');
          c.examples.forEach(ex => this._appendLine('  ' + ex, ''));
          return;
        }
      }
      this._appendLine(`Команда "${args[0]}" не знайдена.`, 'warn');
      return;
    }
    this._appendLine('Доступні команди:', 'head');
    for (const sec of CMD_HELP) {
      this._appendLine(`  ${sec.section}:`, 'info');
      sec.cmds.forEach(c => this._appendLine(`    ${c.name.padEnd(28)} ${c.desc}`, ''));
    }
    this._appendLine('', '');
    this._appendLine('Підказка: натисніть приклад у правій панелі щоб вставити команду.', 'info');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _portName(port, fallbackIdx) {
    const info = port.getInfo?.() ?? {};

    // portName is the OS-level identifier (Chrome 117+):
    // Windows → "COM3", Linux → "ttyUSB0", macOS → "/dev/cu.usbmodem1"
    if (typeof info.portName === 'string' && info.portName.trim()) {
      return _resolveOsPortName(info.portName.trim());
    }

    for (const k of ['displayName', 'path', 'name', 'friendlyName']) {
      const v = info[k];
      if (typeof v === 'string' && v.trim()) return _resolveOsPortName(v.trim());
    }

    if (info.usbVendorId != null) {
      const vid = info.usbVendorId.toString(16).padStart(4,'0');
      const pid = (info.usbProductId ?? 0).toString(16).padStart(4,'0');
      return `USB(${vid.toUpperCase()}:${pid.toUpperCase()})`;
    }

    return `tty? #${fallbackIdx + 1}`;
  }

  _guessType(info) {
    if (!info.usbVendorId) return 'Апаратний UART';
    const vid = info.usbVendorId.toString(16).padStart(4,'0');
    const pid = (info.usbProductId ?? 0).toString(16).padStart(4,'0');
    const map = {
      '1a86': 'CH340/CH341', '10c4': 'CP210x', '0403': 'FTDI',
      '067b': 'PL2303', '2341': 'Arduino', '2a03': 'Arduino',
      '303a': 'ESP32',
    };
    return map[vid] ?? `USB ${vid.toUpperCase()}:${pid.toUpperCase()}`;
  }

  _tabForPort(port) {
    for (const [, tab] of this.app.tabs) {
      if (tab.port === port) return tab;
    }
    return null;
  }

  _defaultConfig() {
    const s = this.app.settings;
    return {
      baudRate:    s.get('baudRate'),
      dataBits:    s.get('dataBits'),
      parity:      s.get('parity'),
      stopBits:    s.get('stopBits'),
      flowControl: s.get('flowControl'),
    };
  }

  // ── Output rendering ──────────────────────────────────────────────────────
  _appendInput(text) {
    const line = document.createElement('div');
    line.className = 'cmd-line cmd-line-input';
    line.innerHTML = `<span class="cmd-line-prompt">›</span><span class="cmd-line-text">${this._esc(text)}</span>`;
    this._output.appendChild(line);
  }

  _appendLine(text, type = '') {
    const line = document.createElement('div');
    line.className = `cmd-line${type ? ' cmd-line-' + type : ''}`;
    line.innerHTML = `<span class="cmd-line-prompt"> </span><span class="cmd-line-text">${this._esc(text)}</span>`;
    this._output.appendChild(line);
  }

  _appendTable(headers, rows) {
    const wrap = document.createElement('div');
    wrap.className = 'cmd-line';
    wrap.innerHTML = '<span class="cmd-line-prompt"> </span>';

    const tbl = document.createElement('table');
    tbl.className = 'cmd-table';

    const thead = tbl.createTHead();
    const hr = thead.insertRow();
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    });

    const tbody = tbl.createTBody();
    rows.forEach(cols => {
      const tr = tbody.insertRow();
      cols.forEach(cell => {
        const td = tr.insertCell();
        td.textContent = cell.text;
        if (cell.cls) td.className = cell.cls;
      });
    });

    wrap.appendChild(tbl);
    this._output.appendChild(wrap);
  }

  _scrollOutput() {
    requestAnimationFrame(() => { this._output.scrollTop = this._output.scrollHeight; });
  }

  _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Linux dialout notice ──────────────────────────────────────────────────
  static _isLinux() {
    const p = navigator.userAgentData?.platform ?? navigator.platform ?? '';
    return /linux/i.test(p);
  }

  _appendLinuxDialoutNote() {
    this._appendNote({
      icon: '⚠',
      cls:  'cmd-note-warn',
      lines: [
        'На Linux деякі порти можуть бути недоступні, якщо поточний користувач не входить до групи <b>dialout</b>.',
        'Щоб надати доступ, виконайте в терміналі:',
      ],
      code:       'sudo usermod -a -G dialout $USER',
      after:      'Після цього потрібно <b>вийти із сеансу та зайти знову</b> (або перезавантажити систему).',
      link:       { text: 'Довідка: доступ до серійних портів у Linux', url: 'https://wiki.archlinux.org/title/Working_with_the_serial_console' },
      storageKey: 'webcom_linux_dialout_dismissed',
    });
  }

  _appendNote({ icon, cls, lines, code, after, link, storageKey }) {
    const note = document.createElement('div');
    note.className = `cmd-note ${cls ?? ''}`;

    // Top row: icon + optional dismiss button
    const header = document.createElement('div');
    header.className = 'cmd-note-header';

    const iconEl = document.createElement('span');
    iconEl.className = 'cmd-note-icon';
    iconEl.textContent = icon;
    header.appendChild(iconEl);

    if (storageKey) {
      const closeBtn = document.createElement('button');
      closeBtn.className   = 'cmd-note-close';
      closeBtn.title       = 'Закрити та більше не показувати';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => {
        localStorage.setItem(storageKey, '1');
        note.remove();
      });
      header.appendChild(closeBtn);
    }

    note.appendChild(header);

    const body = document.createElement('div');
    body.className = 'cmd-note-body';

    lines?.forEach(l => {
      const p = document.createElement('p');
      p.innerHTML = l;
      body.appendChild(p);
    });

    if (code) {
      const pre = document.createElement('code');
      pre.className = 'cmd-note-code';
      pre.textContent = code;
      body.appendChild(pre);
    }

    if (after) {
      const p = document.createElement('p');
      p.innerHTML = after;
      body.appendChild(p);
    }

    if (link) {
      const a = document.createElement('a');
      a.href      = link.url;
      a.textContent = link.text;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      a.className = 'cmd-note-link';
      body.appendChild(a);
    }

    note.appendChild(body);
    this._output.appendChild(note);
  }

  // ── Help panel ────────────────────────────────────────────────────────────
  _buildHelp() {
    const container = document.getElementById('cmd-help-content');
    CMD_HELP.forEach(sec => {
      const section = document.createElement('div');
      section.className = 'help-section';

      const title = document.createElement('div');
      title.className = 'help-section-title';
      title.textContent = sec.section;
      section.appendChild(title);

      sec.cmds.forEach(c => {
        const block = document.createElement('div');
        block.className = 'help-cmd';

        const name = document.createElement('span');
        name.className = 'help-cmd-name';
        name.textContent = c.name;
        block.appendChild(name);

        const desc = document.createElement('span');
        desc.className = 'help-cmd-desc';
        desc.textContent = c.desc;
        block.appendChild(desc);

        c.examples.forEach(ex => {
          const exEl = document.createElement('code');
          exEl.className = 'help-cmd-ex';
          exEl.textContent = ex;
          exEl.dataset.cmd = ex;
          exEl.title = 'Натисніть щоб вставити';
          block.appendChild(exEl);
        });

        section.appendChild(block);
      });

      container.appendChild(section);
    });
  }
}
