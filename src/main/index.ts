import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc/handlers';
import { LedgerStore } from './ledger/store';
import { RolesStore } from './roles/store';
import { makeSafeCipher } from './roles/safeCipher';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let ledger: LedgerStore | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Vibes Desktop',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // The ledger lives in appData; it replays its JSONL on construction.
  ledger = new LedgerStore(app.getPath('userData'));
  // Role endpoints persist alongside the ledger; keys encrypt via the OS safe store.
  const rolesStore = new RolesStore(app.getPath('userData'), makeSafeCipher());
  createWindow();
  registerIpcHandlers(ipcMain, { store: ledger, webContents: mainWindow?.webContents, rolesStore });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
