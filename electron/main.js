const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

// Pollinations blocks browser requests that carry an Origin header. In the
// desktop app we strip Origin/Referer for its hosts so fetch() works directly
// (untainted, downloadable) with no proxy and no API key.
function installHeaderStrip() {
  const filter = { urls: ['https://*.pollinations.ai/*'] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, cb) => {
    const h = details.requestHeaders;
    delete h.Origin; delete h.origin;
    delete h.Referer; delete h.referer;
    cb({ requestHeaders: h });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0a0a13',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));

  // external links open in the default browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  installHeaderStrip();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
