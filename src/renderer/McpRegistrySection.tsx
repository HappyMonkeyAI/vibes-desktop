import React, { useCallback, useMemo, useState } from 'react';
import { Button, Input, Message, Modal, Switch, Tag } from '@arco-design/web-react';
import type { McpRegistryServer } from '@shared/mcpRegistry';
import {
  emptyMcpRegistryServer,
  formatMcpServersJson,
  parseMcpRegistryJson,
  registryToMcpServersJson,
} from '@shared/mcpRegistry';
import styles from './SettingsTab.module.css';

/** T83 — Cursor-ish MCP registry: rows + modal edit + raw JSON (renderer-safe). */

function buildEntry(row: McpRegistryServer): Record<string, unknown> | null {
  const url = row.url.trim();
  if (url) {
    try {
      // eslint-disable-next-line no-new
      new URL(url);
      return { url };
    } catch {
      return null;
    }
  }
  const command = row.command.trim();
  if (!command) return null;
  const trimmed = row.args.trim();
  let args: string[] = [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) args = parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      args = trimmed.split(/\s+/).filter(Boolean);
    }
  } else if (trimmed) {
    args = trimmed.split(/\s+/).filter(Boolean);
  }
  return args.length > 0 ? { command, args } : { command };
}

function sanitizeName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'desktop-custom';
}

type Props = {
  registry: McpRegistryServer[];
  onChange: (next: McpRegistryServer[]) => void;
};

const McpRegistrySection: React.FC<Props> = ({ registry, onChange }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<McpRegistryServer | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);

  const editing = useMemo(
    () => (editId ? registry.find((r) => r.id === editId) ?? null : null),
    [editId, registry],
  );

  const openEdit = useCallback((row: McpRegistryServer) => {
    setEditId(row.id);
    setDraft({ ...row });
  }, []);

  const openAdd = useCallback(() => {
    const row = emptyMcpRegistryServer({ enabled: true, name: `server-${registry.length + 1}` });
    setEditId(row.id);
    setDraft(row);
  }, [registry.length]);

  const closeEdit = useCallback(() => {
    setEditId(null);
    setDraft(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (!draft) return;
    const name = sanitizeName(draft.name);
    const nextRow = { ...draft, name };
    const exists = registry.some((r) => r.id === nextRow.id);
    const next = exists
      ? registry.map((r) => (r.id === nextRow.id ? nextRow : r))
      : [...registry, nextRow];
    onChange(next);
    closeEdit();
  }, [closeEdit, draft, onChange, registry]);

  const removeRow = useCallback(
    (id: string) => {
      onChange(registry.filter((r) => r.id !== id));
      if (editId === id) closeEdit();
    },
    [closeEdit, editId, onChange, registry],
  );

  const toggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      onChange(registry.map((r) => (r.id === id ? { ...r, enabled } : r)));
    },
    [onChange, registry],
  );

  const probe = useCallback(
    async (row: McpRegistryServer) => {
      if (!row.url.trim()) {
        Message.warning('HTTP probe needs a URL. Stdio servers are checked on spawn.');
        return;
      }
      setProbingId(row.id);
      try {
        const result = await window.vibesDesktop.mcp.probe({ url: row.url.trim() });
        onChange(
          registry.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  lastProbeOk: result.ok,
                  lastProbeError: result.ok ? undefined : result.error || result.detail,
                  lastProbedAt: Date.now(),
                }
              : r,
          ),
        );
        if (result.ok) Message.success(`Probe OK — ${result.detail || 'reachable'}`);
        else Message.error(result.error || 'Probe failed');
      } catch (error) {
        Message.error(error instanceof Error ? error.message : 'Probe failed');
      } finally {
        setProbingId(null);
      }
    },
    [onChange, registry],
  );

  const openJson = useCallback(() => {
    const json = registryToMcpServersJson(registry, buildEntry);
    setJsonText(formatMcpServersJson(json));
    setJsonError(null);
    setJsonOpen(true);
  }, [registry]);

  const applyJson = useCallback(() => {
    const parsed = parseMcpRegistryJson(jsonText);
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }
    const next: McpRegistryServer[] = Object.entries(parsed.value.mcpServers).map(([name, cfg], i) => {
      const existing = registry.find((r) => sanitizeName(r.name) === sanitizeName(name));
      const url = typeof cfg.url === 'string' ? cfg.url : '';
      const command = typeof cfg.command === 'string' ? cfg.command : '';
      const args = Array.isArray(cfg.args)
        ? JSON.stringify(cfg.args)
        : typeof cfg.args === 'string'
          ? cfg.args
          : '';
      return emptyMcpRegistryServer({
        id: existing?.id || `json-${i}-${sanitizeName(name)}`,
        name: sanitizeName(name),
        enabled: existing?.enabled ?? true,
        url,
        command,
        args,
        lastProbeOk: existing?.lastProbeOk ?? null,
        lastProbeError: existing?.lastProbeError,
        lastProbedAt: existing?.lastProbedAt,
      });
    });
    onChange(next);
    setJsonOpen(false);
    Message.success(`Loaded ${next.length} server(s) from JSON`);
  }, [jsonText, onChange, registry]);

  return (
    <div className={styles.mcpRegistry}>
      <div className={styles.mcpToolbar}>
        <Button size="small" type="outline" onClick={openAdd}>
          Add server
        </Button>
        <Button size="small" type="outline" onClick={openJson}>
          Edit as JSON
        </Button>
      </div>

      {registry.length === 0 && (
        <p className={styles.hint}>No custom MCP servers yet. Add one or paste a Cursor-style mcpServers JSON.</p>
      )}

      <div className={styles.mcpList}>
        {registry.map((row) => (
          <div key={row.id} className={styles.mcpRow}>
            <Switch
              size="small"
              checked={row.enabled}
              onChange={(v) => toggleEnabled(row.id, v)}
            />
            <div className={styles.mcpRowBody}>
              <strong className={styles.mcpName}>{row.name || '(unnamed)'}</strong>
              <span className={styles.mcpMeta}>
                {row.url.trim()
                  ? `HTTP ${row.url.trim()}`
                  : row.command.trim()
                    ? `stdio ${row.command.trim()}`
                    : 'incomplete'}
              </span>
              {row.lastProbeOk === true && <Tag color="green" size="small">probe ok</Tag>}
              {row.lastProbeOk === false && (
                <Tag color="red" size="small" title={row.lastProbeError || ''}>
                  probe fail
                </Tag>
              )}
              {row.lastProbeError && (
                <span className={styles.mcpError}>{row.lastProbeError}</span>
              )}
            </div>
            <div className={styles.mcpRowActions}>
              {Boolean(row.url.trim()) && (
                <Button
                  size="mini"
                  loading={probingId === row.id}
                  onClick={() => void probe(row)}
                >
                  Probe
                </Button>
              )}
              <Button size="mini" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button size="mini" status="danger" onClick={() => removeRow(row.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        title={editing && registry.some((r) => r.id === editing.id) ? 'Edit MCP server' : 'Add MCP server'}
        visible={Boolean(draft)}
        onCancel={closeEdit}
        onOk={saveEdit}
        okText="Apply"
      >
        {draft && (
          <div className={styles.modalStack}>
            <div className={styles.field}>
              <label className={styles.label}>Name (mcpServers key)</label>
              <Input
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
                size="small"
              />
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Enabled</span>
              <Switch
                size="small"
                checked={draft.enabled}
                onChange={(v) => setDraft({ ...draft, enabled: v })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>HTTP URL (optional — skips stdio when set)</label>
              <Input
                value={draft.url}
                onChange={(v) => setDraft({ ...draft, url: v })}
                placeholder="http://127.0.0.1:8765/mcp"
                size="small"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Stdio command</label>
              <Input
                value={draft.command}
                onChange={(v) => setDraft({ ...draft, command: v })}
                placeholder="npx"
                size="small"
                disabled={Boolean(draft.url.trim())}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Stdio args</label>
              <Input
                value={draft.args}
                onChange={(v) => setDraft({ ...draft, args: v })}
                placeholder="-y some-mcp-package"
                size="small"
                disabled={Boolean(draft.url.trim())}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Edit mcpServers JSON"
        visible={jsonOpen}
        onCancel={() => setJsonOpen(false)}
        onOk={applyJson}
        okText="Apply JSON"
        style={{ width: 'min(640px, calc(100vw - 32px))' }}
      >
        <p className={styles.hint}>
          Cursor-style object with an <code>mcpServers</code> map. Apply replaces the custom registry
          list (HTML Design Advisor stays a separate toggle).
        </p>
        <Input.TextArea
          value={jsonText}
          onChange={setJsonText}
          autoSize={{ minRows: 12, maxRows: 24 }}
        />
        {jsonError && <p className={styles.mcpError}>{jsonError}</p>}
      </Modal>
    </div>
  );
};

export default McpRegistrySection;
