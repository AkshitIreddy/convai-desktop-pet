const { app, BrowserWindow, screen, Menu, Tray, ipcMain, dialog } = require('electron');
const path = require('path');
const CharacterStore = require('./characterStore');

const characterStore = new CharacterStore();

// Add this block for auto-reloading
try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true
  });
} catch (err) { 
  console.error('Failed to load electron-reloader:', err);
}

// Add this CSP configuration at the top of the file with other constants
const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval'",
    "connect-src 'self' https://api.convai.com wss://webstream.convai.com",
    "media-src 'self' blob: data:",
    "worker-src blob:",
    "script-src-elem 'self' 'unsafe-eval'"
].join('; ');

let petWindows = new Map();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true
    }
  })

  // Add handler for close button
  mainWindow.on('close', function(event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives]
      }
    })
  })

  mainWindow.loadFile('index.html')

  // Remove the default menu
  Menu.setApplicationMenu(null)
}

function createPet(name) {
  if (!name) return;

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const taskbarHeight = height - screen.getPrimaryDisplay().workAreaSize.height;
  const taskbarGap = taskbarHeight + 1;  // Increased gap when above taskbar is true

  const petWindow = new BrowserWindow({
    width: width,
    height: height - taskbarGap,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  petWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives]
      }
    })
  })

  petWindow.loadFile('pet.html', { query: { character: name } })
  
  petWindow.setIgnoreMouseEvents(true, { forward: true })

  petWindow.webContents.on('ipc-message', (event, channel, ...args) => {
    if (channel === 'set-ignore-mouse-events') {
      petWindow.setIgnoreMouseEvents(...args)
    } else if (channel === 'set-window-focusable') {
      petWindow.setFocusable(args[0]);
    }
  })

  petWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[${name}]: ${message}`);
  })

  petWindows.set(name, petWindow);
}

let tray;
function createTray() {
  tray = new Tray(path.join(__dirname, 'tray-icon.png'))
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ])
  tray.setToolTip('Convai Desktop Pet')
  tray.setContextMenu(contextMenu)
  
  // Optional: Add double-click handler to show window
  tray.on('double-click', () => {
    mainWindow.show();
  });
}

app.whenReady().then(async () => {
  try {
    await characterStore.initializeStore();
    createWindow();
    createTray();

    const characters = characterStore.getAllCharacters();
    for (const [name, data] of Object.entries(characters)) {
      if (data.spawn) {
        createPet(name);
      }
    }

    ipcMain.on('get-characters', (event) => {
      const characters = characterStore.getAllCharacters();
      event.reply('characters', characters);
    });

    ipcMain.on('update-spawn', (event, name, spawn) => {
      characterStore.setCharacterSpawn(name, spawn);
      if (spawn) {
        createPet(name);
      } else {
        closePet(name);
      }
    });

    ipcMain.on('update-character-id', (event, name, newId) => {
      characterStore.setCharacterId(name, newId);
      characterStore.setCharacterSessionId(name, "-1");
      event.reply('characters', characterStore.getAllCharacters());
      closePet(name);
      createPet(name);
    });

    ipcMain.on('get-api-key', (event) => {
      const apiKey = characterStore.getApiKey();
      event.reply('api-key', apiKey);
    });

    ipcMain.on('update-api-key', (event, newKey) => {
      characterStore.setApiKey(newKey);
      for (const [name, petWindow] of petWindows.entries()) {
        if (!petWindow.isDestroyed()) {
          petWindow.webContents.send('api-key-updated', newKey);
        }
      }
    });

    ipcMain.on('get-character-config', (event, characterName) => {
      const characters = characterStore.getAllCharacters();
      const character = characters[characterName];
      const apiKey = characterStore.getApiKey();
      
      event.reply('character-config', {
        characterId: character.id,
        apiKey: apiKey,
        sessionId: character.session_id
      });
    });

    ipcMain.on('update-session-id', (event, characterName, sessionId) => {
      characterStore.setCharacterSessionId(characterName, sessionId);
    });

    ipcMain.on('get-settings', (event) => {
      const settings = characterStore.getSettings();
      event.reply('settings', settings);
    });

    ipcMain.on('update-settings', (event, settings) => {
      characterStore.updateSettings(settings);
      // Instead of closing and recreating, send a settings update to existing windows
      for (const [name, petWindow] of petWindows.entries()) {
        if (!petWindow.isDestroyed()) {
          petWindow.webContents.send('settings-updated', settings);
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize the app:', error);
    dialog.showErrorBox('Initialization Error', 'Failed to start the application. Please try restarting.');
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function closePet(name) {
  const petWindow = petWindows.get(name);
  if (petWindow) {
    petWindow.close();
    petWindows.delete(name);
  }
}

