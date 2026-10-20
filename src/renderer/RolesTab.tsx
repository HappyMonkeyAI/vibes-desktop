import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Message, Modal, Tag } from '@arco-design/web-react';
import { FullScreen } from '@icon-park/react';
import type { RoleEndpointInput, RoleKey, RolesConfigView, TestConnectionResult } from '@shared/channels';
import styles from './RolesTab.module.css';

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

type RoleDraft = { baseUrl: string; model: string; apiKey: string; hasKey: boolean };
type Draft = Record<RoleKey, RoleDraft>;

function toDraft(view: RolesConfigView): Draft {
  const draft = {} as Draft;
  for (const role of ROLE_KEYS) {
    draft[role] = { baseUrl: view[role].baseUrl, model: view[role].model, apiKey: '', hasKey: view[role].hasKey };
  }
  return draft;
}

type RoleFieldsProps = {
  role: RoleKey;
  draft: RoleDraft;
  inputSize: 'small' | 'default';
  fieldsClassName: string;
  onChange: (field: 'baseUrl' | 'model' | 'apiKey', value: string) => void;
};

const RoleFields: React.FC<RoleFieldsProps> = ({ draft, inputSize, fieldsClassName, onChange }) => (
  <div className={fieldsClassName}>
    <div className={styles.field}>
      <label className={styles.label}>Base URL</label>
      <Input
        placeholder="http://host:11434/v1"
        value={draft.baseUrl}
        onChange={(v) => onChange('baseUrl', v)}
        size={inputSize}
      />
    </div>
    <div className={styles.field}>
      <label className={styles.label}>Model</label>
      <Input
        placeholder="llama3.2"
        value={draft.model}
        onChange={(v) => onChange('model', v)}
        size={inputSize}
      />
    </div>
    <div className={`${styles.field} ${styles.fieldFull}`}>
      <label className={styles.label}>
        API Key <span className={styles.labelHint}>(optional)</span>
      </label>
      <Input.Password
        placeholder="Enter API key if required"
        value={draft.apiKey}
        onChange={(v) => onChange('apiKey', v)}
        size={inputSize}
      />
    </div>
  </div>
);

const RolesTab: React.FC = () => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingRole, setTestingRole] = useState<RoleKey | null>(null);
  const [expandedRole, setExpandedRole] = useState<RoleKey | null>(null);
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
        // Typed key wins; when the field is empty the main process probes with
        // the stored key for this role (a saved key never crosses IPC).
        apiKey: d.apiKey || undefined,
        role,
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
        setExpandedRole(null);
        setDraft((prev) => {
          if (!prev) return prev;
          const cleared = {} as Draft;
          for (const role of ROLE_KEYS) cleared[role] = { ...prev[role], apiKey: '' };
          return cleared;
        });
        try {
          const view = await window.vibesDesktop.roles.get();
          setDraft(toDraft(view));
        } catch {
          // Ignore — local cleared state is still a reasonable UX.
        }
      } else {
        Message.error('Failed to save role configuration.');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [draft]);

  if (loading || !draft) return <div className={styles.loading}>Loading role configuration…</div>;

  const expanded = expandedRole ? draft[expandedRole] : null;
  const expandedTest = expandedRole ? testResult[expandedRole] : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Role Endpoints</h2>
        <p className={styles.subtitle}>
          Configure the base URL, model, and API key for each role. The executor runs on the default endpoint.
          Use the expand control on a card for a larger editor on small screens.
        </p>
      </div>

      <div className={styles.grid}>
        {ROLE_KEYS.map((role) => {
          const d = draft[role];
          const test = testResult[role];
          return (
            <div key={role} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.roleDot} style={{ background: ROLE_COLORS[role] }} />
                <strong className={styles.roleName}>{ROLE_LABELS[role]}</strong>
                {d.hasKey && <Tag color="green" size="small">key stored</Tag>}
                {!d.hasKey && d.apiKey.length > 0 && <Tag color="orange" size="small">new key</Tag>}
                <button
                  type="button"
                  className={styles.expandBtn}
                  title={`Expand ${ROLE_LABELS[role]}`}
                  aria-label={`Expand ${ROLE_LABELS[role]} editor`}
                  onClick={() => setExpandedRole(role)}
                >
                  <FullScreen size={16} />
                </button>
              </div>

              <RoleFields
                role={role}
                draft={d}
                inputSize="small"
                fieldsClassName={styles.fields}
                onChange={(field, value) => updateField(role, field, value)}
              />

              <div className={styles.actions}>
                <Button size="small" loading={testingRole === role} onClick={() => void handleTest(role)} type="primary">
                  {test?.ok ? '✓ Reachable' : 'Test connection'}
                </Button>
                {test && !test.ok && test.error && (
                  <span className={styles.testError}>{test.error}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <Button type="primary" loading={saving} onClick={() => void handleSave()} size="large">
          Save Configuration
        </Button>
      </div>

      <Modal
        visible={expandedRole !== null}
        onCancel={() => setExpandedRole(null)}
        title={
          expandedRole ? (
            <span className={styles.modalTitle}>
              <span className={styles.roleDot} style={{ background: ROLE_COLORS[expandedRole] }} />
              {ROLE_LABELS[expandedRole]}
              {expanded?.hasKey && <Tag color="green" size="small">key stored</Tag>}
              {expanded && !expanded.hasKey && expanded.apiKey.length > 0 && (
                <Tag color="orange" size="small">new key</Tag>
              )}
            </span>
          ) : null
        }
        footer={[
          <Button key="close" onClick={() => setExpandedRole(null)}>Close</Button>,
          expandedRole ? (
            <Button
              key="test"
              type="outline"
              loading={testingRole === expandedRole}
              onClick={() => void handleTest(expandedRole)}
            >
              {expandedTest?.ok ? '✓ Reachable' : 'Test connection'}
            </Button>
          ) : null,
          <Button key="save" type="primary" loading={saving} onClick={() => void handleSave()}>
            Save Configuration
          </Button>,
        ].filter(Boolean)}
        style={{ top: 40, width: 'min(560px, calc(100vw - 32px))' }}
      >
        {expandedRole && expanded && (
          <div className={styles.modalBody}>
            <RoleFields
              role={expandedRole}
              draft={expanded}
              inputSize="default"
              fieldsClassName={styles.modalFields}
              onChange={(field, value) => updateField(expandedRole, field, value)}
            />
            {expandedTest && !expandedTest.ok && expandedTest.error && (
              <p className={styles.testError}>{expandedTest.error}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RolesTab;
