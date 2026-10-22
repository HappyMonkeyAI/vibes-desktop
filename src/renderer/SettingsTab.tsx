import React, { useEffect, useState } from 'react';
import { Button, Input, Message, Select, Switch, Tabs, Tag } from '@arco-design/web-react';
import type { AppSettings, SpeechEngine, VoiceDoctorResult } from '@shared/channels';
import { isDecisionModelConfigured } from '@shared/channels';
import { DEFAULT_SPEECH_MODEL, DEFAULT_SPEECH_PRECISION, SPEECH_MODELS, describeDownload, type SpeechPrecision } from './speech/speech-models';
import styles from './SettingsTab.module.css';

/**
 * Settings — General (paths / prefs), Voice, and optional Decision MCP (KEV).
 */

const SettingsTab: React.FC = () => {
  const [vibesPath, setVibesPath] = useState('');
  const [contextPath, setContextPath] = useState('');
  const [memoryPath, setMemoryPath] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [speechEngine, setSpeechEngine] = useState<SpeechEngine>('builtin');
  const [speechModel, setSpeechModel] = useState(DEFAULT_SPEECH_MODEL);
  const [speechPrecision, setSpeechPrecision] = useState<SpeechPrecision>(DEFAULT_SPEECH_PRECISION);
  const [speechLang, setSpeechLang] = useState('auto');
  const [speechServerUrl, setSpeechServerUrl] = useState('');
  const [speechServerModel, setSpeechServerModel] = useState('');
  const [speechServerApiKey, setSpeechServerApiKey] = useState('');
  const [speechServerHasKey, setSpeechServerHasKey] = useState(false);
  const [decisionMcpUrl, setDecisionMcpUrl] = useState('');
  const [decisionMcpAuthToken, setDecisionMcpAuthToken] = useState('');
  const [decisionMcpHasToken, setDecisionMcpHasToken] = useState(false);
  const [ttsAnnounceEnabled, setTtsAnnounceEnabled] = useState(false);
  const [ttsDaemonUrl, setTtsDaemonUrl] = useState('http://127.0.0.1:4100');
  const [ttsDaemonToken, setTtsDaemonToken] = useState('');
  const [ttsDaemonHasToken, setTtsDaemonHasToken] = useState(false);
  const [htmlDesignAdvisorEnabled, setHtmlDesignAdvisorEnabled] = useState(false);
  const [htmlDesignAdvisorPython, setHtmlDesignAdvisorPython] = useState('python');
  const [htmlDesignAdvisorWorkspace, setHtmlDesignAdvisorWorkspace] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctor, setDoctor] = useState<VoiceDoctorResult | null>(null);
  const [warming, setWarming] = useState(false);
  const [testingServer, setTestingServer] = useState(false);
  const [testingDecision, setTestingDecision] = useState(false);
  const [testingAnnounce, setTestingAnnounce] = useState(false);

  const refreshDoctor = async () => {
    try {
      setDoctor(await window.vibesDesktop.voice.doctor());
    } catch {
      setDoctor(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await window.vibesDesktop.settings.get();
        if (!cancelled) applySettings(settings);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) await refreshDoctor();
    })();
    return () => { cancelled = true; };
  }, []);

  const applySettings = (settings: AppSettings) => {
    setVibesPath(settings.vibesPath);
    setContextPath(settings.contextPath);
    setMemoryPath(settings.memoryPath);
    setAutoSave(settings.autoSave);
    setVerboseLogging(settings.verboseLogging);
    setSpeechEngine(settings.speechEngine ?? 'builtin');
    setSpeechModel(settings.speechModel || DEFAULT_SPEECH_MODEL);
    setSpeechPrecision((settings.speechPrecision as SpeechPrecision) || DEFAULT_SPEECH_PRECISION);
    setSpeechLang(settings.speechLang || 'auto');
    setSpeechServerUrl(settings.speechServerUrl || '');
    setSpeechServerModel(settings.speechServerModel || '');
    setSpeechServerHasKey(Boolean(settings.speechServerHasKey));
    setSpeechServerApiKey('');
    setDecisionMcpUrl(settings.decisionMcpUrl || '');
    setDecisionMcpHasToken(Boolean(settings.decisionMcpHasToken));
    setDecisionMcpAuthToken('');
    setTtsAnnounceEnabled(Boolean(settings.ttsAnnounceEnabled));
    setTtsDaemonUrl(settings.ttsDaemonUrl || 'http://127.0.0.1:4100');
    setTtsDaemonHasToken(Boolean(settings.ttsDaemonHasToken));
    setTtsDaemonToken('');
    setHtmlDesignAdvisorEnabled(Boolean(settings.htmlDesignAdvisorEnabled));
    setHtmlDesignAdvisorPython(settings.htmlDesignAdvisorPython || 'python');
    setHtmlDesignAdvisorWorkspace(settings.htmlDesignAdvisorWorkspace || '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await window.vibesDesktop.settings.save({
        vibesPath,
        contextPath,
        memoryPath,
        autoSave,
        verboseLogging,
        speechEngine,
        speechModel,
        speechPrecision,
        speechLang,
        speechServerUrl,
        speechServerModel,
        speechServerApiKey: speechServerApiKey || undefined,
        decisionMcpUrl,
        decisionMcpAuthToken: decisionMcpAuthToken || undefined,
        ttsAnnounceEnabled,
        ttsDaemonUrl,
        ttsDaemonToken: ttsDaemonToken || undefined,
        htmlDesignAdvisorEnabled,
        htmlDesignAdvisorPython,
        htmlDesignAdvisorWorkspace,
      });
      if (result.ok) {
        Message.success('Settings saved.');
        setSpeechServerApiKey('');
        setDecisionMcpAuthToken('');
        const refreshed = await window.vibesDesktop.settings.get();
        applySettings(refreshed);
      } else {
        Message.error('Failed to save settings.');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleWarm = async () => {
    setWarming(true);
    try {
      const result = await window.vibesDesktop.voice.warm();
      if (result.ok) Message.success(result.detail || 'Models ready.');
      else Message.error(result.error || 'Warm failed.');
      await refreshDoctor();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Warm failed.');
    } finally {
      setWarming(false);
    }
  };

  const handleTestServer = async () => {
    setTestingServer(true);
    try {
      // Persist current URL/model first so the probe uses what the user typed.
      await window.vibesDesktop.settings.save({
        speechServerUrl,
        speechServerModel,
        speechServerApiKey: speechServerApiKey || undefined,
      });
      const result = await window.vibesDesktop.voice.testServer();
      if (result.ok) Message.success('Speech server reachable.');
      else Message.error(result.error || 'Server probe failed.');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Server probe failed.');
    } finally {
      setTestingServer(false);
    }
  };

  const handleTestAnnounce = async () => {
    setTestingAnnounce(true);
    try {
      await window.vibesDesktop.settings.save({
        ttsAnnounceEnabled,
        ttsDaemonUrl,
        ttsDaemonToken: ttsDaemonToken || undefined,
      });
      const refreshed = await window.vibesDesktop.settings.get();
      applySettings(refreshed);
      const result = await window.vibesDesktop.voice.testAnnounce();
      if (result.ok) Message.success('Test announcement accepted by the daemon.');
      else Message.error(result.error || 'Announce failed.');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Announce failed.');
    } finally {
      setTestingAnnounce(false);
    }
  };

  const handleTestDecision = async () => {
    setTestingDecision(true);
    try {
      await window.vibesDesktop.settings.save({
        decisionMcpUrl,
        decisionMcpAuthToken: decisionMcpAuthToken || undefined,
      });
      const refreshed = await window.vibesDesktop.settings.get();
      applySettings(refreshed);
      const result = await window.vibesDesktop.decision.test();
      if (result.ok) Message.success(result.detail || 'Decision MCP reachable.');
      else Message.error(result.error || 'Decision MCP probe failed.');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Decision MCP probe failed.');
    } finally {
      setTestingDecision(false);
    }
  };

  const decisionOn = isDecisionModelConfigured({
    decisionMcpUrl,
    decisionMcpHasToken: decisionMcpHasToken || Boolean(decisionMcpAuthToken.trim()),
  });

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Settings</h2>
      <Tabs defaultActiveTab="general">
        <Tabs.TabPane key="general" title="General">
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Vibes Repo</h3>
            <div className={styles.field}>
              <label className={styles.label}>Vibes Checkout Path</label>
              <Input placeholder="C:/path/to/vibes-repo" value={vibesPath} onChange={setVibesPath} size="small" />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Context & Memory</h3>
            <div className={styles.field}>
              <label className={styles.label}>Context File Path</label>
              <Input placeholder="path/to/context.md" value={contextPath} onChange={setContextPath} size="small" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Memory File Path</label>
              <Input placeholder="path/to/memory.json" value={memoryPath} onChange={setMemoryPath} size="small" />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Preferences</h3>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Auto-save settings</span>
              <Switch checked={autoSave} onChange={setAutoSave} size="small" />
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Verbose logging</span>
              <Switch checked={verboseLogging} onChange={setVerboseLogging} size="small" />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Decision model (KEV)</h3>
            <p className={styles.hint}>
              Optional. When MCP URL and bearer token are set, missions can use a local System One
              decision model (triage / tool choice). Leave blank to keep decision calls off.
            </p>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Status</span>
              {decisionOn
                ? <Tag color="green" size="small">on — URL + token present</Tag>
                : <Tag color="gray" size="small">off — not configured</Tag>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Decision MCP URL</label>
              <Input
                placeholder="http://192.168.5.157:8766/mcp"
                value={decisionMcpUrl}
                onChange={setDecisionMcpUrl}
                size="small"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                MCP bearer token {decisionMcpHasToken && <Tag color="green" size="small">token stored</Tag>}
              </label>
              <Input.Password
                placeholder={decisionMcpHasToken ? 'Leave blank to keep stored token' : 'KEV_MCP_AUTH_TOKEN'}
                value={decisionMcpAuthToken}
                onChange={setDecisionMcpAuthToken}
                size="small"
              />
            </div>
            <div className={styles.actions}>
              <Button size="small" type="outline" loading={testingDecision} onClick={() => void handleTestDecision()}>
                Test decision MCP
              </Button>
            </div>
            <p className={styles.hint}>
              KEV MCP is often :8765/mcp; Gutsy :8766/mcp; Unsloth Studio Decision API{' '}
              <code>http://host:8888/mcp/</code> (Bearer = Unsloth API key; tool <code>system_one</code>).
              Use the MCP URL, not chat <code>/v1</code> or docker <code>:8008</code>. Clear URL to disable.
            </p>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Mission MCP tools</h3>
            <p className={styles.hint}>
              Optional servers merged into the mission workspace <code>.vibes/mcp.json</code> on spawn
              (vibes child loads them). Off removes only the advisor entry; other servers stay.
            </p>
            <div className={styles.row}>
              <span className={styles.rowLabel}>HTML Design Advisor</span>
              <Switch
                checked={htmlDesignAdvisorEnabled}
                onChange={setHtmlDesignAdvisorEnabled}
                size="small"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Python command</label>
              <Input
                placeholder="python"
                value={htmlDesignAdvisorPython}
                onChange={setHtmlDesignAdvisorPython}
                size="small"
                disabled={!htmlDesignAdvisorEnabled}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Catalog workspace (optional)</label>
              <Input
                placeholder="C:/path/to/ui-design"
                value={htmlDesignAdvisorWorkspace}
                onChange={setHtmlDesignAdvisorWorkspace}
                size="small"
                disabled={!htmlDesignAdvisorEnabled}
              />
            </div>
            <p className={styles.hint}>
              Requires <code>pip install</code> of{' '}
              <a href="https://github.com/HappyMonkeyAI/html-design-advisor-mcp" target="_blank" rel="noreferrer">
                html-design-advisor-mcp
              </a>
              . Sets <code>python -m html_design_advisor</code> under key <code>html-design-advisor</code>.
            </p>
          </div>

          <Button type="primary" onClick={() => void handleSave()} loading={loading || saving} size="large" disabled={loading}>
            Save Settings
          </Button>
        </Tabs.TabPane>

        <Tabs.TabPane key="voice" title="Voice">
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Speech engine</h3>
            <div className={styles.enginePick} role="radiogroup" aria-label="Speech engine">
              <button
                type="button"
                className={`${styles.engineOption} ${speechEngine === 'builtin' ? styles.engineOptionActive : ''}`}
                onClick={() => setSpeechEngine('builtin')}
              >
                <div>
                  <div className={styles.engineTitle}>Local · Whisper (in-app)</div>
                  <div className={styles.engineDetail}>
                    Downloads the ONNX model on first hold-to-talk and caches it — same flow as ZeroG Terminal. No pip install.
                  </div>
                </div>
              </button>
              <button
                type="button"
                className={`${styles.engineOption} ${speechEngine === 'server' ? styles.engineOptionActive : ''}`}
                onClick={() => setSpeechEngine('server')}
              >
                <div>
                  <div className={styles.engineTitle}>Server · OpenAI-compatible</div>
                  <div className={styles.engineDetail}>
                    POST to /v1/audio/transcriptions — e.g. local qwen3-asr-server on port 8765.
                  </div>
                </div>
              </button>
              <button
                type="button"
                className={`${styles.engineOption} ${speechEngine === 'yapsnap' ? styles.engineOptionActive : ''}`}
                onClick={() => setSpeechEngine('yapsnap')}
              >
                <div>
                  <div className={styles.engineTitle}>Local · yapsnap (CLI)</div>
                  <div className={styles.engineDetail}>
                    Legacy: requires `pip install yapsnap` and ffmpeg on PATH.
                  </div>
                </div>
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Language</label>
              <Input placeholder="auto" value={speechLang} onChange={setSpeechLang} size="small" />
              <p className={styles.hint}>Use auto unless you want a fixed language code (multilingual models / server).</p>
            </div>
          </div>

          {speechEngine === 'builtin' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Built-in model</h3>
              <div className={styles.field}>
                <label className={styles.label}>Whisper model</label>
                <Select value={speechModel} onChange={(v) => setSpeechModel(String(v))} size="small">
                  {SPEECH_MODELS.map((m) => (
                    <Select.Option key={m.id} value={m.id}>{m.label}</Select.Option>
                  ))}
                </Select>
                <p className={styles.hint}>{describeDownload(speechModel, speechPrecision)}</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Precision</label>
                <Select value={speechPrecision} onChange={(v) => setSpeechPrecision(v as SpeechPrecision)} size="small">
                  <Select.Option value="q8">q8 · quantized (recommended)</Select.Option>
                  <Select.Option value="q4">q4</Select.Option>
                  <Select.Option value="fp16">fp16</Select.Option>
                  <Select.Option value="fp32">fp32 · full</Select.Option>
                </Select>
              </div>
              <p className={styles.hint}>
                Hold to talk on Operations — the first release downloads the model (progress shows on the button). Later utterances use the cache.
              </p>
            </div>
          )}

          {speechEngine === 'yapsnap' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Local readiness</h3>
              <div className={styles.statusList}>
                <div className={doctor?.ffmpegAvailable ? styles.statusOk : styles.statusBad}>
                  ffmpeg: {doctor?.ffmpegAvailable ? 'available' : 'missing'}
                  {!doctor?.ffmpegAvailable && doctor?.ffmpegHint ? ` — ${doctor.ffmpegHint}` : ''}
                </div>
                <div className={doctor?.yapsnapAvailable ? styles.statusOk : styles.statusBad}>
                  yapsnap: {doctor?.yapsnapAvailable ? 'available' : 'missing'}
                  {!doctor?.yapsnapAvailable && doctor?.yapsnapHint ? ` — ${doctor.yapsnapHint}` : ''}
                </div>
                <div>
                  Overall:{' '}
                  {doctor?.ready ? <Tag color="green" size="small">ready</Tag> : <Tag color="orangered" size="small">not ready</Tag>}
                </div>
              </div>
              <div className={styles.actions}>
                <Button size="small" onClick={() => void refreshDoctor()}>Refresh status</Button>
                <Button type="primary" size="small" loading={warming} disabled={!doctor?.yapsnapAvailable} onClick={() => void handleWarm()}>
                  Download / warm models
                </Button>
              </div>
              <p className={styles.hint}>
                Warm runs a short silent clip through yapsnap so the model cache is populated before you hold-to-talk on a mission.
              </p>
            </div>
          )}

          {speechEngine === 'server' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Speech server</h3>
              <div className={styles.field}>
                <label className={styles.label}>Transcriptions URL</label>
                <Input
                  placeholder="http://127.0.0.1:8765/v1/audio/transcriptions"
                  value={speechServerUrl}
                  onChange={setSpeechServerUrl}
                  size="small"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Model</label>
                <Input placeholder="qwen3-asr-0.6b-q8-0" value={speechServerModel} onChange={setSpeechServerModel} size="small" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>API key {speechServerHasKey && <Tag color="green" size="small">key stored</Tag>}</label>
                <Input.Password
                  placeholder={speechServerHasKey ? 'Leave blank to keep stored key' : 'Bearer token if the server requires one'}
                  value={speechServerApiKey}
                  onChange={setSpeechServerApiKey}
                  size="small"
                />
              </div>
              <div className={styles.actions}>
                <Button size="small" type="outline" loading={testingServer} onClick={() => void handleTestServer()}>
                  Test server
                </Button>
              </div>
              <p className={styles.hint}>
                Matches ZeroG Terminal’s server engine. For qwen3-asr-server: URL …/v1/audio/transcriptions, model qwen3-asr-0.6b-q8-0, key from that project’s .env.
              </p>
            </div>
          )}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Mission announce (TTS)</h3>
            <p className={styles.hint}>
              Optional Agent Voice daemon (`POST /v1/announce`). When enabled, speak a short line on mission done/failed.
              Soft-fail — never blocks the mission.
            </p>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Announce on mission terminal</span>
              <Switch checked={ttsAnnounceEnabled} onChange={setTtsAnnounceEnabled} size="small" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Daemon URL</label>
              <Input
                placeholder="http://127.0.0.1:4100"
                value={ttsDaemonUrl}
                onChange={setTtsDaemonUrl}
                size="small"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                Daemon token {ttsDaemonHasToken && <Tag color="green" size="small">token stored</Tag>}
              </label>
              <Input.Password
                placeholder={ttsDaemonHasToken ? 'Leave blank to keep stored token' : 'AVT_TOKEN'}
                value={ttsDaemonToken}
                onChange={setTtsDaemonToken}
                size="small"
              />
            </div>
            <div className={styles.actions}>
              <Button size="small" type="outline" loading={testingAnnounce} onClick={() => void handleTestAnnounce()}>
                Test announce
              </Button>
            </div>
          </div>

          <Button type="primary" onClick={() => void handleSave()} loading={loading || saving} size="large" disabled={loading}>
            Save Settings
          </Button>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default SettingsTab;
