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

export type HtmlDesignAdvisorMcpOptions = {
  enabled: boolean;
  /** Absolute or PATH-resolved python binary. Default: python */
  pythonCommand: string;
  /** Optional HTML_DESIGN_ADVISOR_WORKSPACE override. */
  workspace?: string;
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

/**
 * Upsert or remove the html-design-advisor entry. Returns path written, or null.
 * Refuses non-absolute workspace roots (same rule as writeVibesConfig).
 */
export function writeVibesMcpJson(
  workspaceRoot: string,
  advisor: HtmlDesignAdvisorMcpOptions,
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
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, 'utf-8');
    return target;
  } catch {
    return null;
  }
}
