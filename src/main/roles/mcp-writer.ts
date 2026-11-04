import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Merge optional mission MCP servers into the workspace `.vibes/mcp.json`
 * that vibes loads (cwd `.vibes/mcp.json` when the child is spawned).
 * Only manages keys we own — other servers are left intact.
 */

const VIBES_DIR = '.vibes';
const MCP_FILE = 'mcp.json';
const HTML_DESIGN_ADVISOR_KEY = 'html-design-advisor';
/** Fallback key when the operator leaves the custom name blank. */
export const CUSTOM_MCP_DEFAULT_KEY = 'desktop-custom';

export type HtmlDesignAdvisorMcpOptions = {
  enabled: boolean;
  /** Absolute or PATH-resolved python binary. Default: python */
  pythonCommand: string;
  /** Optional HTML_DESIGN_ADVISOR_WORKSPACE override. */
  workspace?: string;
};

/** One operator-defined MCP server (stdio command or HTTP URL). */
export type CustomMcpOptions = {
  enabled: boolean;
  /** mcpServers object key (sanitized). */
  name: string;
  /** Stdio command (e.g. npx, python). Ignored when `url` is set. */
  command: string;
  /** Whitespace-separated args, or a JSON string array. */
  args: string;
  /** Streamable-HTTP MCP URL — when set, writes `{ url }` instead of stdio. */
  url: string;
  /**
   * Previous key we wrote (so a rename removes the old entry).
   * Empty on first enable.
   */
  previousName?: string;
};

export type McpServersFile = {
  mcpServers: Record<string, Record<string, unknown>>;
};

export function vibesMcpPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, MCP_FILE);
}

function readMcpFile(target: string): McpServersFile {
  if (!existsSync(target)) return { mcpServers: {} };
  try {
    const raw = JSON.parse(readFileSync(target, 'utf-8')) as Partial<McpServersFile>;
    const servers =
      raw.mcpServers && typeof raw.mcpServers === 'object' && !Array.isArray(raw.mcpServers)
        ? { ...raw.mcpServers }
        : {};
    return { mcpServers: servers };
  } catch {
    return { mcpServers: {} };
  }
}

/** Safe mcpServers key: lowercase letters, digits, hyphen, underscore. */
export function sanitizeMcpServerName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || CUSTOM_MCP_DEFAULT_KEY;
}

/** Parse Settings args field into a string array. */
export function parseMcpArgs(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
      }
    } catch {
      /* fall through to whitespace split */
    }
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

/** Build the html-design-advisor stdio entry (HappyMonkeyAI/html-design-advisor-mcp). */
export function htmlDesignAdvisorServerConfig(opts: {
  pythonCommand: string;
  workspace?: string;
}): Record<string, unknown> {
  const command = opts.pythonCommand.trim() || 'python';
  const env: Record<string, string> = {};
  const workspace = opts.workspace?.trim();
  if (workspace) env.HTML_DESIGN_ADVISOR_WORKSPACE = workspace;
  return {
    command,
    args: ['-m', 'html_design_advisor'],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

/** Build custom MCP entry — HTTP url wins over stdio when both present. */
export function customMcpServerConfig(opts: {
  command: string;
  args: string;
  url: string;
}): Record<string, unknown> | null {
  const url = opts.url.trim();
  if (url) {
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      return null;
    }
    return { url };
  }
  const command = opts.command.trim();
  if (!command) return null;
  const args = parseMcpArgs(opts.args);
  return args.length > 0 ? { command, args } : { command };
}

/**
 * Upsert or remove desktop-owned MCP entries. Returns path written, or null.
 * Refuses non-absolute workspace roots (same rule as writeVibesConfig).
 *
 * T83: `customs` may be a list (registry). A single `custom` remains supported.
 * Desktop-managed keys from a previous write are replaced via `managedKeys`.
 */
export function writeVibesMcpJson(
  workspaceRoot: string,
  advisor: HtmlDesignAdvisorMcpOptions,
  custom?: CustomMcpOptions | CustomMcpOptions[] | null,
  opts?: { managedKeys?: string[] },
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const target = vibesMcpPath(workspaceRoot);
  try {
    const file = readMcpFile(target);
    if (advisor.enabled) {
      file.mcpServers[HTML_DESIGN_ADVISOR_KEY] = htmlDesignAdvisorServerConfig({
        pythonCommand: advisor.pythonCommand,
        workspace: advisor.workspace,
      });
    } else {
      delete file.mcpServers[HTML_DESIGN_ADVISOR_KEY];
    }

    const customs = custom == null ? [] : Array.isArray(custom) ? custom : [custom];
    const managed = new Set(
      (opts?.managedKeys ?? []).map(sanitizeMcpServerName).filter(Boolean),
    );
    for (const c of customs) {
      managed.add(sanitizeMcpServerName(c.name));
      if (c.previousName) managed.add(sanitizeMcpServerName(c.previousName));
    }
    for (const key of managed) {
      if (key === HTML_DESIGN_ADVISOR_KEY) continue;
      delete file.mcpServers[key];
    }

    for (const c of customs) {
      const name = sanitizeMcpServerName(c.name);
      const prev = c.previousName ? sanitizeMcpServerName(c.previousName) : '';
      if (prev && prev !== name) delete file.mcpServers[prev];
      if (!c.enabled) continue;
      const entry = customMcpServerConfig(c);
      if (entry) file.mcpServers[name] = entry;
    }

    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, 'utf-8');
    return target;
  } catch {
    return null;
  }
}
