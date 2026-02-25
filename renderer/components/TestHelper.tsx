import { useState, useEffect } from 'react';
import { useModal } from '../context/ModalContext';

/**
 * Test helper component - shows app state for debugging
 * Only visible in development mode
 */
function TestHelper() {
  const modal = useModal();
  const [appDataPath, setAppDataPath] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  useEffect(() => {
    loadAppInfo();
  }, []);

  const loadAppInfo = async () => {
    try {
      const [versionResult, pathResult, configResult, keyResult] = await Promise.all([
        window.electronAPI.getVersion(),
        window.electronAPI.getAppDataPath(),
        window.electronAPI.configGet(),
        window.electronAPI.secretsHasKey(),
      ]);

      setVersion(versionResult);
      setAppDataPath(pathResult);
      setConfig(configResult);
      setHasApiKey(keyResult.success && keyResult.exists);
    } catch (error) {
      console.error('Failed to load app info:', error);
    }
  };

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        zIndex: 10000,
        cursor: 'pointer',
      }}
      onClick={async () => {
        const details = {
          version,
          appDataPath,
          config,
          hasApiKey,
          databasePath: `${appDataPath}\\app.db`,
        };
        console.log('App State:', details);
        await modal.alert(JSON.stringify(details, null, 2));
      }}
      title="Click to see details in console"
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🧪 Test Helper</div>
      <div>Version: {version}</div>
      <div>API Key: {hasApiKey ? '✅ Set' : '❌ Not Set'}</div>
      <div>Output Path: {config?.outputRootPath ? '✅ Set' : '❌ Not Set'}</div>
      <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.7 }}>
        Click for details
      </div>
    </div>
  );
}

export default TestHelper;
