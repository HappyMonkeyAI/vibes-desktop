import React, { useEffect, useState } from 'react';
import { Message, Tabs } from '@arco-design/web-react';
import RolesTab from './RolesTab';
import SettingsTab from './SettingsTab';
import { ThemeToggle } from './ThemeToggle';
import OperationsView from './OperationsView';
import ChatView from './ChatView';
import styles from './MissionControl.module.css';

const App: React.FC = () => {
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  const [engineOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await window.vibesDesktop.settings.get();
        // Builtin Whisper and speech-server need no yapsnap/ffmpeg on PATH.
        if (settings.speechEngine === 'builtin' || settings.speechEngine === 'server') {
          if (!cancelled) setVoiceReady(true);
          return;
        }
        const result = await window.vibesDesktop.voice.doctor();
        if (!cancelled) setVoiceReady(result.ready);
      } catch {
        if (!cancelled) setVoiceReady(true); // prefer ready; capture errors surface on talk
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.page}>
      <Message />
      <header className={styles.header}>
        <h1>Mission Control</h1>
        <span className={styles.subtitle}>Vibes missions, live in one place.</span>
        <span className={styles.headerActions}>
          <span className={styles.livePill}>
            <span className={styles.liveDot} />
            LIVE
          </span>
          <span className={voiceReady ? styles.voicePillReady : styles.voicePill}>
            {voiceReady ? 'VOICE READY' : 'VOICE STANDBY'}
          </span>
          <ThemeToggle />
        </span>
      </header>
      <div className={styles.tabsWrap}>
        <Tabs defaultActiveTab="operations">
          <Tabs.TabPane key="operations" title="Operations">
            <OperationsView />
          </Tabs.TabPane>
          <Tabs.TabPane key="chat" title="Chat">
            <ChatView />
          </Tabs.TabPane>
          <Tabs.TabPane key="roles" title="Roles">
            <RolesTab />
          </Tabs.TabPane>
          <Tabs.TabPane key="settings" title="Settings">
            <SettingsTab />
          </Tabs.TabPane>
        </Tabs>
      </div>
      <footer className={styles.footer} data-purpose="app-footer-status">
        <span className={styles.footerOnline}>
          <span className={styles.footerDot} />
          {engineOnline ? 'Engine online' : 'Engine offline'}
        </span>
        <span className={styles.footerMeta}>child MCP · Hybrid C</span>
        <span className={styles.footerMeta}>Context —</span>
      </footer>
    </div>
  );
};

export default App;
