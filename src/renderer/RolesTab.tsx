import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Message, Tag } from '@arco-design/web-react';
import type { RoleEndpointInput, RoleKey, RolesConfigView, TestConnectionResult } from '@shared/channels';

/**
 * T7 — per-role endpoint configuration. Five forms (default / planner / executor /
 * reviewer / triage), each with base URL, model, and an API key field that only
 * appears when a key is stored for that role. A saved key never round-trips: the
 * view carries a presence flag, and an empty submitted key means "keep what's stored".
 */

const ROLE_LABELS: Record<RoleKey, string> = {
  default: 'Default (Ollama)',
  planner: 'Planner',
  executor: 'Executor',
  reviewer: 'Reviewer',
  triage: 'Triage',
};

const ROLE_KEYS: RoleKey[] = ['default', 'planner', 'executor', 'reviewer', 'triage'];

const ROLE_COLORS: Record<RoleKey, string> = {
  default: '#5b8def',
  planner: '#7a818c',
  executor: '#2ec27e',
  reviewer: '#b07bff',
  triage: '#ff9f43',
};

type Draft = Record<RoleKey, { baseUrl: string; model: string; apiKey: string; hasKey: boolean }>;

function toDraft(view: RolesConfigView): Draft {
  const draft = {} as Draft;
  for (const role of ROLE_KEYS) {
    draft[role] = { baseUrl: view[role].baseUrl, model: view[role].model, apiKey: '', hasKey: view[role].hasKey };
  }
  return draft;
}

const RolesTab: React.FC = () => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingRole, setTestingRole] = useState<RoleKey | null>(null);
  const [testResult, setTestResult] = useState<Record<RoleKey, TestConnectionResult | null>>({
    default: null, planner: null, executor: null, reviewer: null, triage: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const view = await window.vibesDesktop.roles.get();
        if (!cancelled) setDraft(toDraft(view));
      } catch {
        Message.error('Failed to load role configuration.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateField = useCallback((role: RoleKey, field: 'baseUrl' | 'model' | 'apiKey', value: string) => {
    setDraft((prev) => (prev ? { ...prev, [role]: { ...prev[role], [field]: value } } : prev));
  }, []);

  const handleTest = useCallback(async (role: RoleKey) => {
    if (!draft) return;
    const d = draft[role];
    setTestingRole(role);
    setTestResult((prev) => ({ ...prev, [role]: null }));
    try {
      const result = await window.vibesDesktop.roles.testConnection({
        baseUrl: d.baseUrl.trim(),
        model: d.model.trim(),
        apiKey: d.apiKey || undefined,
      });
      setTestResult((prev) => ({ ...prev, [role]: result }));
    } catch (error) {
      setTestResult((prev) => ({ ...prev, [role]: { ok: false, error: error instanceof Error ? error.message : String(error) } }));
    } finally {
      setTestingRole(null);
    }
  }, [draft]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const input = {} as Record<RoleKey, RoleEndpointInput>;
      for (const role of ROLE_KEYS) {
        input[role] = { baseUrl: draft[role].baseUrl, model: draft[role].model, apiKey: draft[role].apiKey };
      }
      const res = await window.vibesDesktop.roles.save(input);
      if (res.ok) {
        Message.success('Role configuration saved.');
        // Clear the key fields locally — they're now stored; presence flag is enough.
        setDraft((prev) => {
          if (!prev) return prev;
          const cleared = {} as Draft;
          for (const role of ROLE_KEYS) cleared[role] = { ...prev[role], apiKey: '' };
          return cleared;
        });
      } else {
        Message.error('Failed to save role configuration.');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [draft]);

  if (loading || !draft) return <div className="roles-loading">Loading role configuration…</div>;

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700 }}>Role Endpoints</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Configure the base URL, model, and API key for each role. The executor runs on the default endpoint.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
        {ROLE_KEYS.map((role) => {
          const d = draft[role];
          const test = testResult[role];
          return (
            <div
              key={role}
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--surface-card)',
                border: '1px solid var(--color-border-2)',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: ROLE_COLORS[role] }} />
                <strong style={{ fontSize: '16px' }}>{ROLE_LABELS[role]}</strong>
                {d.hasKey && <Tag color="green" size="small">key stored</Tag>}
                {!d.hasKey && d.apiKey.length > 0 && <Tag color="orange" size="small">new key</Tag>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base URL</label>
                  <Input placeholder="http://host:11434/v1" value={d.baseUrl} onChange={(v) => updateField(role, 'baseUrl', v)} size="small" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</label>
                  <Input placeholder="llama3.2" value={d.model} onChange={(v) => updateField(role, 'model', v)} size="small" />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Key <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-muted)' }}>(optional)</span></label>
                <Input.Password placeholder="Enter API key if required" value={d.apiKey} onChange={(v) => updateField(role, 'apiKey', v)} size="small" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button size="small" loading={testingRole === role} onClick={() => void handleTest(role)} type={test?.ok ? 'primary' : 'primary'}>
                  {test?.ok ? '✓ Reachable' : 'Test connection'}
                </Button>
                {test && !test.ok && test.error && <span style={{ fontSize: '12px', color: 'rgb(var(--red-6))' }}>{test.error}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Button type="primary" loading={saving} onClick={() => void handleSave()} size="large">Save Configuration</Button>
    </div>
  );
};

export default RolesTab;
