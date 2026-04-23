// Terminal color themes (xterm.js + UI chrome config)
const THEMES = {
  'default-dark': {
    name: 'Default Dark',
    lightChrome: false,
    terminal: {
      background:          '#0d1117',
      foreground:          '#c9d1d9',
      cursor:              '#58a6ff',
      cursorAccent:        '#0d1117',
      selectionBackground: '#264f7840',
      black:       '#484f58', red:          '#ff7b72',
      green:       '#3fb950', yellow:        '#d29922',
      blue:        '#58a6ff', magenta:       '#bc8cff',
      cyan:        '#39c5cf', white:         '#b1bac4',
      brightBlack: '#6e7681', brightRed:     '#ffa198',
      brightGreen: '#56d364', brightYellow:  '#e3b341',
      brightBlue:  '#79c0ff', brightMagenta: '#d2a8ff',
      brightCyan:  '#56d4dd', brightWhite:   '#f0f6fc',
    }
  },

  'dracula': {
    name: 'Dracula',
    lightChrome: false,
    terminal: {
      background:          '#282a36',
      foreground:          '#f8f8f2',
      cursor:              '#f8f8f2',
      cursorAccent:        '#282a36',
      selectionBackground: '#44475a90',
      black:       '#21222c', red:          '#ff5555',
      green:       '#50fa7b', yellow:        '#f1fa8c',
      blue:        '#bd93f9', magenta:       '#ff79c6',
      cyan:        '#8be9fd', white:         '#f8f8f2',
      brightBlack: '#6272a4', brightRed:     '#ff6e6e',
      brightGreen: '#69ff94', brightYellow:  '#ffffa5',
      brightBlue:  '#d6acff', brightMagenta: '#ff92df',
      brightCyan:  '#a4ffff', brightWhite:   '#ffffff',
    }
  },

  'solarized-dark': {
    name: 'Solarized Dark',
    lightChrome: false,
    terminal: {
      background:          '#002b36',
      foreground:          '#839496',
      cursor:              '#93a1a1',
      cursorAccent:        '#002b36',
      selectionBackground: '#586e7540',
      black:       '#073642', red:          '#dc322f',
      green:       '#859900', yellow:        '#b58900',
      blue:        '#268bd2', magenta:       '#d33682',
      cyan:        '#2aa198', white:         '#eee8d5',
      brightBlack: '#002b36', brightRed:     '#cb4b16',
      brightGreen: '#586e75', brightYellow:  '#657b83',
      brightBlue:  '#839496', brightMagenta: '#6c71c4',
      brightCyan:  '#93a1a1', brightWhite:   '#fdf6e3',
    }
  },

  'solarized-light': {
    name: 'Solarized Light',
    lightChrome: true,
    terminal: {
      background:          '#fdf6e3',
      foreground:          '#657b83',
      cursor:              '#586e75',
      cursorAccent:        '#fdf6e3',
      selectionBackground: '#93a1a140',
      black:       '#073642', red:          '#dc322f',
      green:       '#859900', yellow:        '#b58900',
      blue:        '#268bd2', magenta:       '#d33682',
      cyan:        '#2aa198', white:         '#eee8d5',
      brightBlack: '#002b36', brightRed:     '#cb4b16',
      brightGreen: '#586e75', brightYellow:  '#657b83',
      brightBlue:  '#839496', brightMagenta: '#6c71c4',
      brightCyan:  '#93a1a1', brightWhite:   '#fdf6e3',
    }
  },

  'nord': {
    name: 'Nord',
    lightChrome: false,
    terminal: {
      background:          '#2e3440',
      foreground:          '#d8dee9',
      cursor:              '#d8dee9',
      cursorAccent:        '#2e3440',
      selectionBackground: '#4c566a70',
      black:       '#3b4252', red:          '#bf616a',
      green:       '#a3be8c', yellow:        '#ebcb8b',
      blue:        '#81a1c1', magenta:       '#b48ead',
      cyan:        '#88c0d0', white:         '#e5e9f0',
      brightBlack: '#4c566a', brightRed:     '#bf616a',
      brightGreen: '#a3be8c', brightYellow:  '#ebcb8b',
      brightBlue:  '#81a1c1', brightMagenta: '#b48ead',
      brightCyan:  '#8fbcbb', brightWhite:   '#eceff4',
    }
  },

  'monokai': {
    name: 'Monokai',
    lightChrome: false,
    terminal: {
      background:          '#272822',
      foreground:          '#f8f8f2',
      cursor:              '#f8f8f0',
      cursorAccent:        '#272822',
      selectionBackground: '#49483e',
      black:       '#272822', red:          '#f92672',
      green:       '#a6e22e', yellow:        '#f4bf75',
      blue:        '#66d9e8', magenta:       '#ae81ff',
      cyan:        '#a1efe4', white:         '#f8f8f2',
      brightBlack: '#75715e', brightRed:     '#f92672',
      brightGreen: '#a6e22e', brightYellow:  '#f4bf75',
      brightBlue:  '#66d9e8', brightMagenta: '#ae81ff',
      brightCyan:  '#a1efe4', brightWhite:   '#f9f8f5',
    }
  },

  'one-dark': {
    name: 'One Dark',
    lightChrome: false,
    terminal: {
      background:          '#282c34',
      foreground:          '#abb2bf',
      cursor:              '#528bff',
      cursorAccent:        '#282c34',
      selectionBackground: '#3e445270',
      black:       '#282c34', red:          '#e06c75',
      green:       '#98c379', yellow:        '#e5c07b',
      blue:        '#61afef', magenta:       '#c678dd',
      cyan:        '#56b6c2', white:         '#abb2bf',
      brightBlack: '#5c6370', brightRed:     '#e06c75',
      brightGreen: '#98c379', brightYellow:  '#e5c07b',
      brightBlue:  '#61afef', brightMagenta: '#c678dd',
      brightCyan:  '#56b6c2', brightWhite:   '#ffffff',
    }
  },

  'gruvbox-dark': {
    name: 'Gruvbox Dark',
    lightChrome: false,
    terminal: {
      background:          '#282828',
      foreground:          '#ebdbb2',
      cursor:              '#ebdbb2',
      cursorAccent:        '#282828',
      selectionBackground: '#50494880',
      black:       '#282828', red:          '#cc241d',
      green:       '#98971a', yellow:        '#d79921',
      blue:        '#458588', magenta:       '#b16286',
      cyan:        '#689d6a', white:         '#a89984',
      brightBlack: '#928374', brightRed:     '#fb4934',
      brightGreen: '#b8bb26', brightYellow:  '#fabd2f',
      brightBlue:  '#83a598', brightMagenta: '#d3869b',
      brightCyan:  '#8ec07c', brightWhite:   '#ebdbb2',
    }
  },

  'tomorrow-night': {
    name: 'Tomorrow Night',
    lightChrome: false,
    terminal: {
      background:          '#1d1f21',
      foreground:          '#c5c8c6',
      cursor:              '#aeafad',
      cursorAccent:        '#1d1f21',
      selectionBackground: '#373b4170',
      black:       '#1d1f21', red:          '#cc6666',
      green:       '#b5bd68', yellow:        '#f0c674',
      blue:        '#81a2be', magenta:       '#b294bb',
      cyan:        '#8abeb7', white:         '#c5c8c6',
      brightBlack: '#969896', brightRed:     '#cc6666',
      brightGreen: '#b5bd68', brightYellow:  '#f0c674',
      brightBlue:  '#81a2be', brightMagenta: '#b294bb',
      brightCyan:  '#8abeb7', brightWhite:   '#ffffff',
    }
  },

  'material-dark': {
    name: 'Material Dark',
    lightChrome: false,
    terminal: {
      background:          '#212121',
      foreground:          '#eeffff',
      cursor:              '#ffcc02',
      cursorAccent:        '#212121',
      selectionBackground: '#42424270',
      black:       '#212121', red:          '#f07178',
      green:       '#c3e88d', yellow:        '#ffcb6b',
      blue:        '#82aaff', magenta:       '#c792ea',
      cyan:        '#89ddff', white:         '#eeffff',
      brightBlack: '#546e7a', brightRed:     '#ff5370',
      brightGreen: '#c3e88d', brightYellow:  '#ffcb6b',
      brightBlue:  '#82aaff', brightMagenta: '#c792ea',
      brightCyan:  '#89ddff', brightWhite:   '#ffffff',
    }
  },
};
