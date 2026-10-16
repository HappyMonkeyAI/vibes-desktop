import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc/handlers';
import { LedgerStore } from './ledger/store';
import { RolesStore } from './roles/store';
import { makeSafeCipher } from './roles/safeCipher';
import { writeVibesConfig } from './roles/config-writer';
import { createMissionService } from './mission/service';
import { VibesBridge } from './bridge/vibes-bridge';
import { WorkspaceHistoryStore } from './workspace/history';

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
  // Workspace history store
  const workspaceHistoryStore = new WorkspaceHistoryStore(app.getPath('userData'));
  // T13/T14 — mission lifecycle. The bridge factory writes the native config before
  // each spawn so a child always reads the per-role endpoints we just saved.
  const missionService = createMissionService({
    store: ledger,
    vibesPath: () => process.env['VIBES_PATH'],
    createBridge: (workspaceRoot) => {
      writeVibesConfig(workspaceRoot, rolesStore.input());
      const vibesPath = process.env['VIBES_PATH'] ?? 'C:/Users/steph/AppData/Local/Temp/vibes';
      return new VibesBridge({ vibesPath, workspaceRoot });
    },
  });
  createWindow();
  // Native folder picker for the mission working directory (parented to the focused window).
  const selectWorkspace = async () => {
    const parent = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const res = await dialog.showOpenDialog(parent!, { properties: ['openDirectory'] });
    return { path: res.canceled ? null : (res.filePaths[0] ?? null) };
  };
  registerIpcHandlers(ipcMain, { store: ledger, webContents: mainWindow?.webContents, rolesStore, missionService, selectWorkspace, workspaceHistoryStore });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
