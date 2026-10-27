import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { registerIpcHandlers } from './ipc/handlers';
import { LedgerStore } from './ledger/store';
import { RolesStore } from './roles/store';
import { makeSafeCipher } from './roles/safeCipher';
import { writeVibesConfig } from './roles/config-writer';
import { writeVibesMcpJson } from './roles/mcp-writer';
import { createMissionService } from './mission/service';
import { resolveDecisionMcpConfig } from './decision/config';
import { VibesBridge } from './bridge/vibes-bridge';
import { WorkspaceHistoryStore } from './workspace/history';
import { SettingsStore } from './settings/store';

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
  // App settings (Settings tab) — speech-server key uses the same OS cipher as Roles.
  const settingsStore = new SettingsStore(app.getPath('userData'), makeSafeCipher());
  // One-time soft-migrate: previous default was yapsnap CLI; builtin Whisper
  // downloads on first talk (ZeroG-style) and does not require pip. A user who
  // re-selects yapsnap afterwards keeps it (the store records the migration).
  settingsStore.migrateSpeechEngine();
  // T13/T14 — mission lifecycle. The bridge factory writes the native config before
  // each spawn so a child always reads the per-role endpoints we just saved.
  // writeVibesConfig itself refuses non-absolute roots, so a bad value can never
  // write .vibes/config.json into the app's own source tree.
  // vibesPath: VIBES_PATH env (dev) > settings.vibesPath. No hardcoded machine paths.
  const resolveVibesPath = (): string => {
    const candidates = [
      process.env['VIBES_PATH'],
      settingsStore.get().vibesPath,
    ].filter((c): c is string => !!c);
    for (const candidate of candidates) {
      if (existsSync(path.join(candidate, 'src', 'mcp', 'server.ts'))) return candidate;
    }
    throw new Error(
      'No valid vibes checkout found. Set vibesPath in Settings (or VIBES_PATH env) to a repo containing src/mcp/server.ts.',
    );
  };
  const missionService = createMissionService({
    store: ledger,
    userDataPath: app.getPath('userData'),
    settingsStore,
    vibesPath: () => {
      try { return resolveVibesPath(); } catch { return undefined; }
    },
    createBridge: (workspaceRoot) => {
      const decision = resolveDecisionMcpConfig(settingsStore);
      const settings = settingsStore.get();
      writeVibesConfig(workspaceRoot, rolesStore.input(), decision, {
        maxSteps: settings.maxSteps,
        maxConcurrentTasks: settings.maxConcurrentTasks,
        yoloMode: settings.yoloMode,
        thinkingMode: settings.thinkingMode,
        contextCompactionEnabled: settings.contextCompactionEnabled,
        smallModelProfile: settings.smallModelProfile,
        triageEnabled: settings.triageEnabled,
        triageInterval: settings.triageInterval,
        triageAutoSteer: settings.triageAutoSteer,
        memoryEnabled: settings.memoryEnabled,
        localMemory: settings.localMemory,
      });
      writeVibesMcpJson(workspaceRoot, {
        enabled: settings.htmlDesignAdvisorEnabled,
        pythonCommand: settings.htmlDesignAdvisorPython || 'python',
        workspace: settings.htmlDesignAdvisorWorkspace || undefined,
      });
      const llmEnv: Record<string, string> = {};
      if (decision) {
        llmEnv.KEV_MCP_URL = decision.url;
        llmEnv.KEV_MCP_AUTH_TOKEN = decision.token;
        llmEnv.ENABLE_DECISION_INTERVENE_GATE = 'true';
      }
      return new VibesBridge({ vibesPath: resolveVibesPath(), workspaceRoot, llmEnv });
    },
  });
  createWindow();
  // Native folder picker for the mission working directory (parented to the focused window).
  const selectWorkspace = async () => {
    const parent = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const options = { properties: ['openDirectory' as const] };
    const res = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return { path: res.canceled ? null : (res.filePaths[0] ?? null) };
  };
  registerIpcHandlers(ipcMain, { store: ledger, webContents: mainWindow?.webContents, rolesStore, missionService, selectWorkspace, workspaceHistoryStore, settingsStore });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
