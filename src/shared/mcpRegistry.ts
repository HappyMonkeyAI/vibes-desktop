/**
 * T83 — operator MCP registry (Settings → Mission MCP tools).
 * Desktop owns the catalogue UX; vibes child loads `.vibes/mcp.json` on spawn.
 * Role/task filtering is T84/T85 — this file is registry shape only.
 */

export type McpRegistryServer = {
  /** Stable id for React keys / rename tracking. */
  id: string;
  /** mcpServers object key (sanitized on write). */
  name: string;
  enabled: boolean;
  /** HTTP URL — when set, transport is HTTP and stdio fields are ignored. */
  url: string;
  /** Stdio command (e.g. npx, python). */
  command: string;
  /** Whitespace-separated or JSON string array. */
  args: string;
  /** Last HTTP probe result (stdio = validate-only). */
  lastProbeOk?: boolean | null;
  lastProbeError?: string;
  lastProbedAt?: number;
};

export type McpServersJson = {
  mcpServers: Record<string, Record<string, unknown>>;
};

export function emptyMcpRegistryServer(partial?: Partial<McpRegistryServer>): McpRegistryServer {
  return {
    id: partial?.id || `mcp-${Date.now().toString(36)}`,
    name: partial?.name ?? 'desktop-custom',
    enabled: partial?.enabled ?? false,
    url: partial?.url ?? '',
    command: partial?.command ?? '',
    args: partial?.args ?? '',
    lastProbeOk: partial?.lastProbeOk ?? null,
    lastProbeError: partial?.lastProbeError,
    lastProbedAt: partial?.lastProbedAt,
  };
}

/** Migrate legacy single customMcp* Settings fields into a one-row registry. */
export function migrateLegacyCustomMcp(input: {
  enabled: boolean;
  name: string;
  command: string;
  args: string;
  url: string;
}): McpRegistryServer[] {
  if (!input.enabled && !input.url.trim() && !input.command.trim()) return [];
  return [
    emptyMcpRegistryServer({
      id: 'legacy-custom',
      name: input.name.trim() || 'desktop-custom',
      enabled: input.enabled,
      url: input.url,
      command: input.command,
      args: input.args,
    }),
  ];
}

export function parseMcpRegistryJson(raw: string): { ok: true; value: McpServersJson } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: { mcpServers: {} } };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Root must be a JSON object.' };
    }
    const root = parsed as Record<string, unknown>;
    const servers = root.mcpServers;
    if (servers === undefined) return { ok: true, value: { mcpServers: {} } };
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
      return { ok: false, error: 'mcpServers must be an object of server configs.' };
    }
    const mcpServers: Record<string, Record<string, unknown>> = {};
    for (const [key, val] of Object.entries(servers as Record<string, unknown>)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        mcpServers[key] = { ...(val as Record<string, unknown>) };
      }
    }
    return { ok: true, value: { mcpServers } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

/** Merge registry rows into a Cursor-style mcpServers object (enabled only). */
export function registryToMcpServersJson(
  registry: McpRegistryServer[],
  buildEntry: (row: McpRegistryServer) => Record<string, unknown> | null,
): McpServersJson {
  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const row of registry) {
    if (!row.enabled) continue;
    const entry = buildEntry(row);
    if (!entry) continue;
    const key = row.name.trim() || row.id;
    mcpServers[key] = entry;
  }
  return { mcpServers };
}

export function formatMcpServersJson(value: McpServersJson): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
