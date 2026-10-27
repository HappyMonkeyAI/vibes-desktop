import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Message, Modal, Steps } from '@arco-design/web-react';
import styles from './FirstRunSetup.module.css';

/**
 * Closed-beta first-run: Vibes checkout → default model → workspace → Mission Control.
 * BYO stack (docs/BETA.md). Skip sets setupComplete so the modal does not return.
 */

export type FirstRunFinished = {
  workspaceRoot?: string;
};

export type FirstRunSetupProps = {
  visible: boolean;
  onFinished: (result?: FirstRunFinished) => void;
};

const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ visible, onFinished }) => {
  const [step, setStep] = useState(1);
  const [vibesPath, setVibesPath] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434');
  const [model, setModel] = useState('');
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      try {
        const [settings, roles, history] = await Promise.all([
          window.vibesDesktop.settings.get(),
          window.vibesDesktop.roles.get(),
          window.vibesDesktop.workspace.history.get(),
        ]);
        if (cancelled) return;
        if (settings.vibesPath.trim()) setVibesPath(settings.vibesPath);
        if (roles.default.baseUrl.trim()) setBaseUrl(roles.default.baseUrl);
        if (roles.default.model.trim()) setModel(roles.default.model);
        if (history[0]?.path) setWorkspaceRoot(history[0].path);
      } catch {
        // Prefill is best-effort; wizard still works empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const markComplete = useCallback(async (extra?: { vibesPath?: string; workspaceRoot?: string }) => {
    setSaving(true);
    try {
      const root = extra?.workspaceRoot?.trim();
      if (root) {
        await window.vibesDesktop.workspace.history.save(root);
      }
      await window.vibesDesktop.settings.save({
        setupComplete: true,
        ...(extra?.vibesPath !== undefined ? { vibesPath: extra.vibesPath } : {}),
      });
      onFinished(root ? { workspaceRoot: root } : undefined);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Could not save setup.');
    } finally {
      setSaving(false);
    }
  }, [onFinished]);

  const handleSkip = useCallback(() => {
    void markComplete();
  }, [markComplete]);

  const handleBrowseVibes = useCallback(async () => {
    const res = await window.vibesDesktop.workspace.select();
    if (res.path) setVibesPath(res.path);
  }, []);

  const handleBrowseWorkspace = useCallback(async () => {
    const res = await window.vibesDesktop.workspace.select();
    if (res.path) setWorkspaceRoot(res.path);
  }, []);

  const handleSavePath = useCallback(async () => {
    const path = vibesPath.trim();
    setSaving(true);
    try {
      const check = await window.vibesDesktop.settings.validateVibesPath(path);
      if (!check.ok) {
        Message.warning(check.error ?? 'Invalid Vibes path.');
        return;
      }
      await window.vibesDesktop.settings.save({ vibesPath: path });
      setStep(2);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Could not save Vibes path.');
    } finally {
      setSaving(false);
    }
  }, [vibesPath]);

  const handleTestModel = useCallback(async () => {
    const url = baseUrl.trim();
    const m = model.trim();
    if (!url || !m) {
      Message.warning('Base URL and model are required to test.');
      return;
    }
    setTesting(true);
    try {
      const result = await window.vibesDesktop.roles.testConnection({
        role: 'default',
        baseUrl: url,
        model: m,
      });
      if (result.ok) {
        Message.success('Endpoint reachable.');
      } else {
        Message.error(result.error ?? 'Connection failed.');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Connection test failed.');
    } finally {
      setTesting(false);
    }
  }, [baseUrl, model]);

  const handleSaveRole = useCallback(async () => {
    const url = baseUrl.trim();
    const m = model.trim();
    if (!url || !m) {
      Message.warning('Base URL and model are required for the default role.');
      return;
    }
    setSaving(true);
    try {
      const view = await window.vibesDesktop.roles.get();
      await window.vibesDesktop.roles.save({
        ...view,
        default: {
          baseUrl: url,
          model: m,
          contextWindow: view.default.contextWindow || '',
          apiKey: '',
        },
        planner: { baseUrl: view.planner.baseUrl, model: view.planner.model, contextWindow: view.planner.contextWindow, apiKey: '' },
        executor: { baseUrl: view.executor.baseUrl, model: view.executor.model, contextWindow: view.executor.contextWindow, apiKey: '' },
        reviewer: { baseUrl: view.reviewer.baseUrl, model: view.reviewer.model, contextWindow: view.reviewer.contextWindow, apiKey: '' },
        triage: { baseUrl: view.triage.baseUrl, model: view.triage.model, contextWindow: view.triage.contextWindow, apiKey: '' },
      });
      setStep(3);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Could not save role endpoint.');
    } finally {
      setSaving(false);
    }
  }, [baseUrl, model]);

  const handleFinish = useCallback(() => {
    void markComplete({
      vibesPath: vibesPath.trim() || undefined,
      workspaceRoot: workspaceRoot.trim() || undefined,
    });
  }, [markComplete, vibesPath, workspaceRoot]);

  return (
    <Modal
      visible={visible}
      title="Welcome — closed beta setup"
      onCancel={handleSkip}
      footer={null}
      maskClosable={false}
      style={{ width: 'min(520px, calc(100vw - 32px))' }}
    >
      <p className={styles.lead}>
        Vibes Desktop needs a Vibes checkout and a local OpenAI-compatible model.
        Full notes: docs/BETA.md in the repo.
      </p>
      <Steps current={step} size="small" className={styles.steps}>
        <Steps.Step title="Vibes" />
        <Steps.Step title="Model" />
        <Steps.Step title="Workspace" />
      </Steps>

      {step === 1 && (
        <div className={styles.panel}>
          <label className={styles.label}>Vibes checkout path</label>
          <div className={styles.pathRow}>
            <Input
              placeholder="C:/path/to/vibes (must contain src/mcp/server.ts)"
              value={vibesPath}
              onChange={setVibesPath}
              size="default"
            />
            <Button onClick={() => void handleBrowseVibes()}>Browse</Button>
          </div>
          <p className={styles.hint}>
            We check for <code>src/mcp/server.ts</code> before continuing. Or set VIBES_PATH before launch.
          </p>
          <div className={styles.actions}>
            <Button onClick={handleSkip}>Skip for now</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSavePath()}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.panel}>
          <label className={styles.label}>Default endpoint base URL</label>
          <Input
            placeholder="http://127.0.0.1:11434"
            value={baseUrl}
            onChange={setBaseUrl}
            size="default"
          />
          <label className={styles.label}>Model id</label>
          <Input
            placeholder="llama3.2"
            value={model}
            onChange={setModel}
            size="default"
          />
          <p className={styles.hint}>
            Saved to the Default role. You can refine Planner/Reviewer later on the Roles tab.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button loading={testing} onClick={() => void handleTestModel()}>
              Test connection
            </Button>
            <Button type="primary" loading={saving} onClick={() => void handleSaveRole()}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.panel}>
          <label className={styles.label}>Mission workspace</label>
          <div className={styles.pathRow}>
            <Input
              placeholder="Folder where missions will run (git repo or project dir)"
              value={workspaceRoot}
              onChange={setWorkspaceRoot}
              size="default"
            />
            <Button onClick={() => void handleBrowseWorkspace()}>Browse</Button>
          </div>
          <p className={styles.hint}>
            Optional now — you can also pick it on Operations. After this, enter a short mission and press Start.
            Decision / Needs You is optional under Settings.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => setStep(2)}>Back</Button>
            <Button type="primary" loading={saving} onClick={handleFinish}>
              Open Mission Control
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default FirstRunSetup;
