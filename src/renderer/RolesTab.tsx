import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Message, Modal, Select, Tag } from '@arco-design/web-react';
import { FullScreen } from '@icon-park/react';
import type {
  RoleEndpointInput,
  RoleKey,
  RoleReasoningEffort,
  RoleReasoningMode,
  RolesConfigView,
  TestConnectionResult,
} from '@shared/channels';
import {
  formatAllowlistForInput,
  formatToolAllowlistForInput,
  normalizeMcpServerAllowlist,
  normalizeMcpToolAllowlist,
  suggestToolBudget,
} from '@shared/mcpPolicy';
import styles from './RolesTab.module.css';

/**
 * T7 / T79 / T86 / T84 — per-role endpoints: URL, model, context, reasoning,
 * MCP/tool policy, constitution, API key. Constitutions → role-constitutions.json;
 * reasoning → role-reasoning.json; MCP policy → role-mcp-policy.json (T85 activates).
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

type RoleDraft = {
  baseUrl: string;
  model: string;
  contextWindow: string;
  systemPrompt: string;
  reasoningMode: RoleReasoningMode;
  reasoningEffort: RoleReasoningEffort;
  mcpServersText: string;
  mcpToolsText: string;
  mcpToolBudget: string;
  apiKey: string;
  hasKey: boolean;
};
type Draft = Record<RoleKey, RoleDraft>;
type RoleFieldKey =
  | 'baseUrl'
  | 'model'
  | 'contextWindow'
  | 'systemPrompt'
  | 'reasoningMode'
  | 'reasoningEffort'
  | 'mcpServersText'
  | 'mcpToolsText'
  | 'mcpToolBudget'
  | 'apiKey';

const REASONING_MODE_OPTIONS: { value: RoleReasoningMode; label: string }[] = [
  { value: 'inherit', label: 'Inherit Runtime' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

const REASONING_EFFORT_OPTIONS: { value: RoleReasoningEffort; label: string }[] = [
  { value: 'inherit', label: 'Inherit / unset' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'xhigh', label: 'XHigh' },
  { value: 'einstein', label: 'Einstein (heavy)' },
  { value: 'spoon', label: 'Spoon / Ultra (max)' },
];

function toDraft(view: RolesConfigView): Draft {
  const draft = {} as Draft;
  for (const role of ROLE_KEYS) {
    draft[role] = {
      baseUrl: view[role].baseUrl,
      model: view[role].model,
      contextWindow: view[role].contextWindow ?? '',
      systemPrompt: view[role].systemPrompt ?? '',
      reasoningMode: view[role].reasoningMode ?? 'inherit',
      reasoningEffort: view[role].reasoningEffort ?? 'inherit',
      mcpServersText: formatAllowlistForInput(view[role].mcpServers ?? []),
      mcpToolsText: formatToolAllowlistForInput(view[role].mcpTools ?? []),
      mcpToolBudget: view[role].mcpToolBudget ?? '',
      apiKey: '',
      hasKey: view[role].hasKey,
    };
  }
  return draft;
}

/** Allow digits and light separators while typing; persist path normalizes. */
function sanitizeContextWindowInput(value: string): string {
  return value.replace(/[^\d_\s,]/g, '');
}

type RoleFieldsProps = {
  role: RoleKey;
  draft: RoleDraft;
  inputSize: 'small' | 'default';
  fieldsClassName: string;
  onChange: (field: RoleFieldKey, value: string) => void;
};

const RoleFields: React.FC<RoleFieldsProps> = ({ role, draft, inputSize, fieldsClassName, onChange }) => (
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
    <div className={styles.field}>
      <label className={styles.label}>
        Context window <span className={styles.labelHint}>(tokens)</span>
      </label>
      <Input
        placeholder="32768"
        value={draft.contextWindow}
        onChange={(v) => onChange('contextWindow', sanitizeContextWindowInput(v))}
        size={inputSize}
        inputMode="numeric"
      />
      {(role === 'planner' || role === 'reviewer' || role === 'triage') && (
        <span className={styles.fieldHint}>
          Stored per role; vibes runtime budget uses Default / Executor.
        </span>
      )}
    </div>
    <div className={styles.field}>
      <label className={styles.label}>Reasoning</label>
      <Select
        value={draft.reasoningMode}
        onChange={(v) => onChange('reasoningMode', v as RoleReasoningMode)}
        size={inputSize}
        options={REASONING_MODE_OPTIONS}
      />
      {(role === 'default' || role === 'executor') && (
        <span className={styles.fieldHint}>
          Overrides Settings → Runtime THINKING_MODE when not Inherit.
        </span>
      )}
    </div>
    <div className={styles.field}>
      <label className={styles.label}>
        Effort <span className={styles.labelHint}>(Qwen / Heretic)</span>
      </label>
      <Select
        value={draft.reasoningEffort}
        onChange={(v) => onChange('reasoningEffort', v as RoleReasoningEffort)}
        size={inputSize}
        options={REASONING_EFFORT_OPTIONS}
      />
      <span className={styles.fieldHint}>
        Stored in role-reasoning.json; API kwargs need vibes companion.
      </span>
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
    <details className={`${styles.field} ${styles.fieldFull} ${styles.constitution}`}>
      <summary className={styles.constitutionSummary}>
        MCP tools
        <span className={styles.labelHint}> policy (T84)</span>
        {(draft.mcpServersText.trim() || draft.mcpToolsText.trim() || draft.mcpToolBudget.trim()) && (
          <Tag color="arcoblue" size="small" style={{ marginLeft: 8 }}>set</Tag>
        )}
      </summary>
      <p className={styles.fieldHint}>
        Allowlists write to <code>.vibes/role-mcp-policy.json</code> (do not rewrite{' '}
        <code>mcp.json</code>). Vibes applies them when building the mission tool catalogue.
      </p>
      <div className={styles.field}>
        <label className={styles.label}>Server allowlist</label>
        <Input
          placeholder="html-design-advisor, desktop-custom"
          value={draft.mcpServersText}
          onChange={(v) => onChange('mcpServersText', v)}
          size={inputSize}
        />
        <span className={styles.fieldHint}>
          Keys from Settings → Mission MCP tools. Empty = unrestricted.
        </span>
      </div>
      <div className={styles.field} style={{ marginTop: 8 }}>
        <label className={styles.label}>Tool allowlist</label>
        <Input.TextArea
          placeholder={"read_file\nwrite_file"}
          value={draft.mcpToolsText}
          onChange={(v) => onChange('mcpToolsText', v)}
          autoSize={{ minRows: 2, maxRows: 6 }}
        />
        <span className={styles.fieldHint}>One name per line (or commas). Empty = all tools.</span>
      </div>
      <div className={styles.field} style={{ marginTop: 8 }}>
        <label className={styles.label}>
          Tool budget <span className={styles.labelHint}>(max tools)</span>
        </label>
        <Input
          placeholder={`auto ≈ ${suggestToolBudget(Number(draft.contextWindow.replace(/[_\s,]/g, '') || '0'))}`}
          value={draft.mcpToolBudget}
          onChange={(v) => onChange('mcpToolBudget', sanitizeContextWindowInput(v))}
          size={inputSize}
          inputMode="numeric"
        />
        <span className={styles.fieldHint}>
          Empty uses context window ({suggestToolBudget(Number(draft.contextWindow.replace(/[_\s,]/g, '') || '0'))}{' '}
          suggested). Manual digits override.
        </span>
      </div>
    </details>
    <details className={`${styles.field} ${styles.fieldFull} ${styles.constitution}`}>
      <summary className={styles.constitutionSummary}>
        Constitution
        <span className={styles.labelHint}> system prompt SoT</span>
        {draft.systemPrompt.trim().length > 0 && (
          <Tag color="arcoblue" size="small" style={{ marginLeft: 8 }}>set</Tag>
        )}
      </summary>
      <p className={styles.fieldHint}>
        Operator-owned source of truth for this role. Mission overlays (T80) may
        refine a task but cannot rewrite this constitution.
      </p>
      <Input.TextArea
        placeholder="You are the planner: break the mission into verifiable steps…"
        value={draft.systemPrompt}
        onChange={(v) => onChange('systemPrompt', v)}
        autoSize={{ minRows: inputSize === 'small' ? 3 : 5, maxRows: 12 }}
      />
    </details>
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

  const updateField = useCallback((role: RoleKey, field: RoleFieldKey, value: string) => {
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
        input[role] = {
          baseUrl: draft[role].baseUrl,
          model: draft[role].model,
          contextWindow: draft[role].contextWindow,
          systemPrompt: draft[role].systemPrompt,
          reasoningMode: draft[role].reasoningMode,
          reasoningEffort: draft[role].reasoningEffort,
          mcpServers: normalizeMcpServerAllowlist(draft[role].mcpServersText),
          mcpTools: normalizeMcpToolAllowlist(draft[role].mcpToolsText),
          mcpToolBudget: draft[role].mcpToolBudget,
          apiKey: draft[role].apiKey,
        };
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
          Configure endpoints, reasoning, MCP tool policy, constitution, and API key per role.
          Executor context window (or Default&apos;s) becomes vibes&apos; CONTEXT_WINDOW.
          Constitutions → <code>.vibes/role-constitutions.json</code>; reasoning →
          <code>.vibes/role-reasoning.json</code>; MCP policy →
          <code>.vibes/role-mcp-policy.json</code> (T85 activates filters).
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
