import { useState, useEffect } from 'react';
import GenerateScreen from './screens/GenerateScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfilesScreen from './screens/ProfilesScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChangelogScreen from './screens/ChangelogScreen';
import TestHelper from './components/TestHelper';

type Screen = 'generate' | 'history' | 'profiles' | 'settings' | 'changelog';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('generate');
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion).catch(() => setVersion('—'));
  }, []);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="nav-header">
          <img src="./icon.ico" alt="" className="nav-header-icon" />
          <div className="nav-header-text">
            <h1 className="nav-header-title">Resume Tailor</h1>
            <div className="nav-header-meta">
              <span className="nav-version">v{version}</span>
              <div className={`mode-badge ${process.env.NODE_ENV === 'development' ? 'mode-dev' : 'mode-prod'}`}>
                {process.env.NODE_ENV === 'development' ? 'DEV' : 'PROD'}
              </div>
            </div>
          </div>
        </div>
        <ul className="nav-list">
          <li>
            <button
              className={currentScreen === 'generate' ? 'active' : ''}
              onClick={() => setCurrentScreen('generate')}
            >
              Generate
            </button>
          </li>
          <li>
            <button
              className={currentScreen === 'history' ? 'active' : ''}
              onClick={() => setCurrentScreen('history')}
            >
              History
            </button>
          </li>
          <li>
            <button
              className={currentScreen === 'profiles' ? 'active' : ''}
              onClick={() => setCurrentScreen('profiles')}
            >
              Profiles
            </button>
          </li>
          <li>
            <button
              className={currentScreen === 'settings' ? 'active' : ''}
              onClick={() => setCurrentScreen('settings')}
            >
              Settings
            </button>
          </li>
          <li>
            <button
              className={currentScreen === 'changelog' ? 'active' : ''}
              onClick={() => setCurrentScreen('changelog')}
            >
              Changelog
            </button>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        {currentScreen === 'generate' && <GenerateScreen />}
        {currentScreen === 'history' && <HistoryScreen />}
        {currentScreen === 'profiles' && <ProfilesScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
        {currentScreen === 'changelog' && <ChangelogScreen />}
      </main>
      <TestHelper />
    </div>
  );
}

export default App;
