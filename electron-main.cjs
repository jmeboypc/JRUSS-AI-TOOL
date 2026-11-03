const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    title: 'JRUSS AI TOOL - v2.5.5',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// Global handler for all web contents (main window, secondary windows, webviews)
// Ensures any external link opens strictly in the user's default OS browser (Chrome, Edge, etc.)
app.on('web-contents-created', (_event, contents) => {
  const isDev = !app.isPackaged;

  // Intercept window.open and <a target="_blank">
  contents.setWindowOpenHandler(({ url }) => {
    // Allow internal secondary pupil projector window
    if (url.includes('whiteboard-pupil') || url.includes('#/whiteboard-pupil')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 750,
          autoHideMenuBar: true,
          title: 'JRUSS AI TOOL - Whiteboard Projector Display',
          icon: path.join(__dirname, 'icon.ico'),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          }
        }
      };
    }

    // Open any external URL (updates, jruss.co.uk, Google AI, OpenAI, Anthropic) in default browser
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept in-app navigations (e.g. clicking standard links inside markdown or html)
  contents.on('will-navigate', (event, url) => {
    const isDevServer = isDev && (url.startsWith('http://localhost:5173') || url.startsWith('http://127.0.0.1:5173'));
    if (!isDevServer && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
