import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { JsonRpcClient } from './jsonrpc';

/**
 * T4 — VibesBridge. Spawns the vibes MCP server as a child process and speaks
 * JSON-RPC 2.0 over stdio (T3 transport). Ported from
 * vibes-dashboard/server/vibes-bridge.js, adapted:
 *   - single instance (one mission at a time; T14 enforces the guard)
 *   - Windows-safe env base (the dashboard's POSIX MINIMAL_PATH/HOME dirs do not apply)
 *   - structured [TASK_STATUS] events parsed out of stderr for the activity ledger
 */

/** LLM keys the child may see — everything else in our env stays behind. */
const ALLOWED_VIBES_ENV_KEYS = new Set([
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL',
  'GEMINI_API_KEY', 'GEMINI_MODEL',
  'GROQ_API_KEY', 'GROQ_MODEL', 'MISTRAL_API_KEY', 'MISTRAL_MODEL',
  'OPENROUTER_API_KEY', 'OPENROUTER_BASE_URL', 'OPENROUTER_MODEL',
  'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL',
  'OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'OLLAMA_API_KEY', 'CONTEXT_WINDOW',
]);

/** Minimal platform base env so the child can find node/tsx but sees no app secrets. */
export function buildChildEnv(llmEnv: Record<string, string> = {}): Record<string, string> {
  const win = process.platform === 'win32';
  const keys = win
    ? ['SystemRoot', 'SystemDrive', 'Path', 'PATHEXT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'HOME']
    : ['PATH', 'HOME', 'LANG', 'TMPDIR'];
  const env: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  // Only allowlisted LLM keys cross into the child — everything else stays behind.
  for (const [key, value] of Object.entries(llmEnv)) {
    if (ALLOWED_VIBES_ENV_KEYS.has(key)) env[key] = value;
  }
  return env;
}

export interface TaskStatusEvent {
  name: string;
  status: 'in-progress' | 'complete' | 'failed';
}

export type InterventionAction = 'retry' | 'skip' | 'fail' | 'reply';

export interface VibesBridgeOptions {
  /** Absolute path to a vibes checkout (must contain src/mcp/server.ts). */
  vibesPath: string;
  /** Working directory the mission runs in. */
  workspaceRoot: string;
  /** LLM endpoint overrides written into the child env (allowlisted keys only). */
  llmEnv?: Record<string, string>;
}

const PLAN_TIMEOUT_MS = 600_000; // planning can take a long time on slow local models
const EXECUTE_TIMEOUT_MS = 3_600_000; // an hour ceiling for a full mission
const TASK_STATUS_RE = /^\[TASK_STATUS\] (.*)$/;

export class VibesBridge extends EventEmitter {
  readonly client = new JsonRpcClient();
  private proc: ReturnType<typeof spawn> | null = null;
  private options: VibesBridgeOptions;
  private initialized = false;

  constructor(options: VibesBridgeOptions) {
    super();
    this.options = options;
    // Forward raw stderr logs and structured task events to listeners.
    this.client.on('log', (line: string) => {
      const match = TASK_STATUS_RE.exec(line);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]) as TaskStatusEvent;
          if (typeof parsed.name === 'string' && typeof parsed.status === 'string') {
            this.emit('task-status', parsed);
            return;
          }
        } catch {
          // malformed task status line — fall through to plain log
        }
      }
      this.emit('log', line);
    });
    this.client.on('exit', (code: number | null) => this.emit('exit', code));
    // A child 'error' with no listener is an uncaught exception that kills the
    // main process (spec S2 violation). Swallow it here — pending requests are
    // already rejected by the client and surface as a failed mission.
    this.client.on('error', () => {});
  }

  get isRunning(): boolean {
    return this.client.isRunning;
  }

  async start(): Promise<void> {
    const root = this.options.vibesPath;
    const serverScript = path.join(root, 'src', 'mcp', 'server.ts');
    if (!existsSync(serverScript)) {
      throw new Error(`vibes checkout not found: ${serverScript} missing. Set vibesPath to a vibes repo.`);
    }

    // Prefer the checkout's local tsx CLI run by the bundled Node runtime (the
    // Electron binary with ELECTRON_RUN_AS_NODE); fall back to whatever `tsx`
    // resolves on PATH. A bare .bin/tsx shim is a cmd batch file on Windows and
    // cannot be spawned directly without shell:true, so we point at the real JS
    // entry when the package is installed locally. If neither exists, fail fast
    // with an actionable message instead of a spawn ENOENT crash (S2).
    const localTsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const shim = path.join(root, 'node_modules', '.bin', 'tsx');
    let tsxBinary: string;
    let tsxArgs: string[];
    if (existsSync(localTsxCli)) {
      tsxBinary = process.execPath;
      tsxArgs = [localTsxCli, '--no-warnings', serverScript];
    } else if (existsSync(shim)) {
      tsxBinary = shim;
      tsxArgs = ['--no-warnings', serverScript];
    } else {
      throw new Error('tsx not found — run `npm install` inside the vibes checkout so its local tsx CLI is available.');
    }

    const env = buildChildEnv(this.options.llmEnv ?? {});
    if (tsxBinary === process.execPath) env.ELECTRON_RUN_AS_NODE = '1';
    env.VIBES_LAUNCH_DIR = this.options.workspaceRoot;

    const proc = spawn(tsxBinary, tsxArgs, {
      cwd: this.options.workspaceRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    this.proc = proc;
    this.client.attach(proc);

    await this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vibes-desktop', version: '0.0.1' },
      });
      this.initialized = true;
    } catch (err) {
      await this.stop();
      throw new Error(`Failed to initialize Vibes MCP: ${(err as Error).message}`);
    }
  }

  /** Plan a mission without executing. Returns the tool's text result. */
  async planMission(description: string): Promise<string> {
    return (await this.callTool('plan_mission', {
      description,
      workspace_root: this.options.workspaceRoot,
    }, PLAN_TIMEOUT_MS)) as string;
  }

  /** Execute the previously planned mission. Returns the tool's text result. */
  async executePlanned(): Promise<string> {
    return (await this.callTool('start_execution', {}, EXECUTE_TIMEOUT_MS)) as string;
  }

  async queryStatus(): Promise<string> {
    return (await this.callTool('query_status', {})) as string;
  }

  async resolveIntervention(action: InterventionAction, message?: string, retryFromTaskId?: string): Promise<string> {
    return (await this.callTool('resolve_intervention', { action, message, retryFromTaskId })) as string;
  }

  private async callTool(name: string, args: Record<string, unknown>, timeoutMs = 30_000): Promise<unknown> {
    if (!this.initialized) throw new Error('bridge not initialized');
    return this.client.sendRequest('tools/call', { name, arguments: args }, timeoutMs);
  }

  /** End the child process and reject any in-flight requests. */
  async stop(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    this.initialized = false;
    if (!proc) return;
    try {
      proc.stdin?.end();
    } catch {
      // already closed
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // already dead
        }
        resolve();
      }, 3000);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
