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
    <div>
      {ROLE_KEYS.map((role) => {
        const d = draft[role];
        const test = testResult[role];
        return (
          <div key={role} style={{ marginBottom: 'var(--wd-spacing-2xl, 24px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <strong>{ROLE_LABELS[role]}</strong>
              {d.hasKey && <Tag color="green" size="small">key stored</Tag>}
              {!d.hasKey && d.apiKey.length > 0 && <Tag color="orange" size="small">new key</Tag>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
              <Input
                placeholder="Base URL (e.g. http://host:11434/v1)"
                value={d.baseUrl}
                onChange={(v) => updateField(role, 'baseUrl', v)}
              />
              <Input
                placeholder="Model name"
                value={d.model}
                onChange={(v) => updateField(role, 'model', v)}
              />
              {d.hasKey || d.apiKey.length > 0 ? (
                <Input.Password
                  placeholder="API key"
                  value={d.apiKey}
                  onChange={(v) => updateField(role, 'apiKey', v)}
                  style={{ width: '200px' }}
                />
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <Button size="small" loading={testingRole === role} onClick={() => void handleTest(role)}>
                Test connection
              </Button>
              {test?.ok && <Tag color="green">reachable</Tag>}
              {test && !test.ok && test.error && (
                <span style={{ color: 'rgb(var(--red-6))', fontSize: '12px' }}>{test.error}</span>
              )}
            </div>
          </div>
        );
      })}
      <Button type="primary" loading={saving} onClick={() => void handleSave()}>
        Save configuration
      </Button>
    </div>
  );
};

export default RolesTab;
