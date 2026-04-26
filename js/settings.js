const KEY = 'webcom_v1';

const DEFAULTS = {
  baudRate:        115200,
  dataBits:        8,
  parity:          'none',
  stopBits:        1,
  flowControl:     'none',
  theme:           'default-dark',
  fontSize:        14,
  lang:            '',
  showWelcome:     true,
  skipPortSettings:false,
};

class Settings {
  constructor() {
    this._d = { ...DEFAULTS };
    this._load();
  }

  _load() {
    try {
      const cookie = document.cookie.split('; ').find(r => r.startsWith(KEY + '='));
      if (cookie) {
        const val = decodeURIComponent(cookie.slice(KEY.length + 1));
        Object.assign(this._d, JSON.parse(val));
        return;
      }
    } catch { /* ignore */ }
    try {
      const ls = localStorage.getItem(KEY);
      if (ls) Object.assign(this._d, JSON.parse(ls));
    } catch { /* ignore */ }
  }

  _save() {
    const json = JSON.stringify(this._d);
    try {
      const exp = new Date();
      exp.setFullYear(exp.getFullYear() + 2);
      document.cookie =
        `${KEY}=${encodeURIComponent(json)}` +
        `; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
    } catch { /* ignore */ }
    try {
      localStorage.setItem(KEY, json);
    } catch { /* ignore */ }
  }

  get(key)        { return this._d[key] ?? DEFAULTS[key]; }
  set(key, value) { this._d[key] = value; this._save(); }

  setMany(obj)    { Object.assign(this._d, obj); this._save(); }

  portConfig() {
    return {
      baudRate:    Number(this._d.baudRate),
      dataBits:    Number(this._d.dataBits),
      parity:      this._d.parity,
      stopBits:    Number(this._d.stopBits),
      flowControl: this._d.flowControl,
    };
  }
}
