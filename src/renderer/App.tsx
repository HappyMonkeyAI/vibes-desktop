import { Message, Tabs } from '@arco-design/web-react';
import RolesTab from './RolesTab';
import SettingsTab from './SettingsTab';
import { ThemeToggle } from './ThemeToggle';
import OperationsView from './OperationsView';
import styles from './MissionControl.module.css';

const App: React.FC = () => (
  <div className={styles.page}>
    {/* Arco static Message API mounts here — required on React 18+ where ReactDOM.render is gone. */}
    <Message />
    <header className={styles.header}>
      <h1>Mission Control</h1>
      <span className={styles.subtitle}>Vibes missions, live in one place.</span>
      <span className={styles.headerActions}>
        <ThemeToggle />
      </span>
    </header>
    <Tabs defaultActiveTab="operations">
      <Tabs.TabPane key="operations" title="Operations">
        <OperationsView />
      </Tabs.TabPane>
      <Tabs.TabPane key="roles" title="Roles">
        <RolesTab />
      </Tabs.TabPane>
      <Tabs.TabPane key="settings" title="Settings">
        <SettingsTab />
      </Tabs.TabPane>
    </Tabs>
  </div>
);

export default App;
