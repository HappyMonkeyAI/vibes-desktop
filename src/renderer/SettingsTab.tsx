import React, { useState } from 'react';
import { Button, Input, Switch, Message } from '@arco-design/web-react';

/**
 * Settings tab for configuring app behavior, context, and memory options.
 */

const SettingsTab: React.FC = () => {
  const [contextPath, setContextPath] = useState('');
  const [memoryPath, setMemoryPath] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [verboseLogging, setVerboseLogging] = useState(false);

  const handleSave = () => {
    Message.success('Settings saved.');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 700 }}>Settings</h2>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Context & Memory</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '4px' }}>Context File Path</label>
          <Input
            placeholder="path/to/context.md"
            value={contextPath}
            onChange={setContextPath}
            size="small"
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '4px' }}>Memory File Path</label>
          <Input
            placeholder="path/to/memory.json"
            value={memoryPath}
            onChange={setMemoryPath}
            size="small"
          />
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Preferences</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px' }}>Auto-save settings</span>
          <Switch checked={autoSave} onChange={setAutoSave} size="small" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px' }}>Verbose logging</span>
          <Switch checked={verboseLogging} onChange={setVerboseLogging} size="small" />
        </div>
      </div>

      <Button type="primary" onClick={handleSave} size="large">Save Settings</Button>
    </div>
  );
};

export default SettingsTab;