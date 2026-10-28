import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  htmlDesignAdvisorServerConfig,
  customMcpServerConfig,
  parseMcpArgs,
  sanitizeMcpServerName,
  writeVibesMcpJson,
  vibesMcpPath,
} from '../src/main/roles/mcp-writer';

describe('mcp-writer (html-design-advisor registry)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-mcp-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('builds stdio config with optional workspace env', () => {
    expect(htmlDesignAdvisorServerConfig({ pythonCommand: 'py' })).toEqual({
      command: 'py',
      args: ['-m', 'html_design_advisor'],
    });
    expect(
      htmlDesignAdvisorServerConfig({
        pythonCommand: 'python',
        workspace: 'C:/ui-design',
      }),
    ).toEqual({
      command: 'python',
      args: ['-m', 'html_design_advisor'],
      env: { HTML_DESIGN_ADVISOR_WORKSPACE: 'C:/ui-design' },
    });
  });

  it('writes advisor when enabled and removes when disabled', () => {
    const written = writeVibesMcpJson(dir, {
      enabled: true,
      pythonCommand: 'python',
      workspace: path.join(dir, 'ui'),
    });
    expect(written).toBe(vibesMcpPath(dir));
    const on = JSON.parse(fs.readFileSync(written!, 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(on.mcpServers['html-design-advisor']).toBeTruthy();

    // Preserve unrelated servers.
    on.mcpServers.other = { command: 'echo' };
    fs.writeFileSync(written!, `${JSON.stringify(on, null, 2)}\n`);

    writeVibesMcpJson(dir, { enabled: false, pythonCommand: 'python' });
    const off = JSON.parse(fs.readFileSync(written!, 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(off.mcpServers['html-design-advisor']).toBeUndefined();
    expect(off.mcpServers.other).toEqual({ command: 'echo' });
  });

  it('refuses relative workspace roots', () => {
    expect(writeVibesMcpJson('relative/ws', { enabled: true, pythonCommand: 'python' })).toBeNull();
  });

  it('sanitizes names and parses args', () => {
    expect(sanitizeMcpServerName(' My Server! ')).toBe('my-server');
    expect(parseMcpArgs('-y foo-bar')).toEqual(['-y', 'foo-bar']);
    expect(parseMcpArgs('["a","b"]')).toEqual(['a', 'b']);
  });

  it('builds HTTP or stdio custom entries', () => {
    expect(customMcpServerConfig({ command: '', args: '', url: 'http://127.0.0.1:9/mcp' })).toEqual({
      url: 'http://127.0.0.1:9/mcp',
    });
    expect(customMcpServerConfig({ command: 'npx', args: '-y pkg', url: '' })).toEqual({
      command: 'npx',
      args: ['-y', 'pkg'],
    });
    expect(customMcpServerConfig({ command: '', args: '', url: 'not-a-url' })).toBeNull();
  });

  it('writes and removes a custom MCP alongside the advisor', () => {
    writeVibesMcpJson(
      dir,
      { enabled: true, pythonCommand: 'python' },
      {
        enabled: true,
        name: 'my-tools',
        command: 'npx',
        args: '-y demo-mcp',
        url: '',
      },
    );
    const on = JSON.parse(fs.readFileSync(vibesMcpPath(dir), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(on.mcpServers['html-design-advisor']).toBeTruthy();
    expect(on.mcpServers['my-tools']).toEqual({ command: 'npx', args: ['-y', 'demo-mcp'] });

    writeVibesMcpJson(
      dir,
      { enabled: true, pythonCommand: 'python' },
      {
        enabled: false,
        name: 'my-tools',
        command: 'npx',
        args: '-y demo-mcp',
        url: '',
      },
    );
    const off = JSON.parse(fs.readFileSync(vibesMcpPath(dir), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(off.mcpServers['my-tools']).toBeUndefined();
    expect(off.mcpServers['html-design-advisor']).toBeTruthy();
  });
});
