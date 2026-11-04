import { describe, expect, it } from 'vitest';
import {
  emptyMcpRegistryServer,
  formatMcpServersJson,
  migrateLegacyCustomMcp,
  parseMcpRegistryJson,
  registryToMcpServersJson,
} from '../src/shared/mcpRegistry';
import { resolveMcpRegistry } from '../src/main/settings/store';
import { writeVibesMcpJson, vibesMcpPath } from '../src/main/roles/mcp-writer';
import { probeHttpMcp } from '../src/main/roles/mcp-probe';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('mcpRegistry (T83)', () => {
  it('migrates legacy single custom MCP', () => {
    const rows = migrateLegacyCustomMcp({
      enabled: true,
      name: 'My Server',
      command: 'npx',
      args: '-y foo',
      url: '',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.enabled).toBe(true);
    expect(rows[0]?.command).toBe('npx');
  });

  it('parses Cursor-style mcpServers JSON', () => {
    const ok = parseMcpRegistryJson(`{
      "mcpServers": {
        "alpha": { "url": "http://127.0.0.1:9/mcp" },
        "beta": { "command": "npx", "args": ["-y", "pkg"] }
      }
    }`);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(Object.keys(ok.value.mcpServers)).toEqual(['alpha', 'beta']);
  });

  it('rejects bad JSON roots', () => {
    expect(parseMcpRegistryJson('[]').ok).toBe(false);
    expect(parseMcpRegistryJson('{ "mcpServers": [] }').ok).toBe(false);
  });

  it('resolveMcpRegistry prefers mcpRegistry over legacy', () => {
    const fromRegistry = resolveMcpRegistry({
      mcpRegistry: [emptyMcpRegistryServer({ id: 'a', name: 'a', enabled: true, url: 'http://x' })],
      customMcpEnabled: true,
      customMcpName: 'legacy',
      customMcpUrl: 'http://legacy',
    });
    expect(fromRegistry).toHaveLength(1);
    expect(fromRegistry[0]?.name).toBe('a');
  });

  it('writes multiple enabled registry servers and drops managed keys', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-mcp-reg-'));
    try {
      const target = writeVibesMcpJson(
        dir,
        { enabled: false, pythonCommand: 'python' },
        [
          { enabled: true, name: 'one', command: 'npx', args: '-y a', url: '' },
          { enabled: false, name: 'two', command: 'npx', args: '-y b', url: '' },
          { enabled: true, name: 'three', command: '', args: '', url: 'http://127.0.0.1:9/mcp' },
        ],
        { managedKeys: ['one', 'two', 'three', 'stale'] },
      );
      expect(target).toBe(vibesMcpPath(dir));
      const file = JSON.parse(fs.readFileSync(target!, 'utf8')) as {
        mcpServers: Record<string, unknown>;
      };
      expect(file.mcpServers.one).toEqual({ command: 'npx', args: ['-y', 'a'] });
      expect(file.mcpServers.two).toBeUndefined();
      expect(file.mcpServers.three).toEqual({ url: 'http://127.0.0.1:9/mcp' });
      expect(file.mcpServers.stale).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('registryToMcpServersJson skips disabled / invalid', () => {
    const json = registryToMcpServersJson(
      [
        emptyMcpRegistryServer({ name: 'ok', enabled: true, url: 'http://127.0.0.1:1/mcp' }),
        emptyMcpRegistryServer({ name: 'off', enabled: false, url: 'http://127.0.0.1:2/mcp' }),
        emptyMcpRegistryServer({ name: 'bad', enabled: true, url: '', command: '' }),
      ],
      (row) => (row.url.trim() ? { url: row.url.trim() } : null),
    );
    expect(Object.keys(json.mcpServers)).toEqual(['ok']);
    expect(formatMcpServersJson(json)).toContain('"ok"');
  });
});

describe('probeHttpMcp', () => {
  it('rejects empty or invalid URLs', async () => {
    expect(await probeHttpMcp('')).toMatchObject({ ok: false });
    expect(await probeHttpMcp('not-a-url')).toMatchObject({ ok: false });
  });

  it('treats HTTP 200 JSON-RPC as ok', async () => {
    const result = await probeHttpMcp('http://example.test/mcp', async () =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), { status: 200 }),
    );
    expect(result.ok).toBe(true);
  });

  it('surfaces 401 clearly', async () => {
    const result = await probeHttpMcp('http://example.test/mcp', async () =>
      new Response('nope', { status: 401 }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/401/);
  });
});
