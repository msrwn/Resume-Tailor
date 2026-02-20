import { useState, useEffect } from 'react';
import type { AppConfig } from '@shared/types';

function SettingsScreen() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [apiKeyExists, setApiKeyExists] = useState<boolean>(false);
  const [apiKeyValue, setApiKeyValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const appConfig = await window.electronAPI.configGet();
      setConfig(appConfig);

      const hasKeyResult = await window.electronAPI.secretsHasKey();
      if (hasKeyResult.success) {
        setApiKeyExists(hasKeyResult.exists);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOutputPath = async () => {
    try {
      const result = await window.electronAPI.dialogSelectFolder();
      if (result.success && result.path && config) {
        const newConfig = { ...config, outputRootPath: result.path };
        await saveConfig(newConfig);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
      setMessage({ type: 'error', text: 'Failed to select folder' });
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    await saveConfig(config);
  };

  const saveConfig = async (newConfig: AppConfig) => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.configSet(newConfig);
      if (result.success) {
        setConfig(newConfig);
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetApiKey = async () => {
    let key = apiKeyValue.trim();
    
    if (!key) {
      setMessage({ type: 'error', text: 'API key cannot be empty' });
      return;
    }

    // Sanitize: remove common command prefixes and quotes
    key = key.replace(/^(setx\s+OPENAI_API_KEY\s+["']?)/i, '');
    key = key.replace(/["']\s*$/, '');
    key = key.trim();

    // Validate format
    if (!key.startsWith('sk-')) {
      setMessage({ 
        type: 'error', 
        text: 'Invalid API key format. OpenAI API keys should start with "sk-". Make sure you copied only the key, not the command.' 
      });
      return;
    }

    if (key.length < 20) {
      setMessage({ type: 'error', text: 'API key appears too short. Please check and try again.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.secretsSetKey(key);
      if (result.success) {
        setApiKeyExists(true);
        setApiKeyValue('');
        setMessage({ type: 'success', text: 'API key saved successfully' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save API key' });
      }
    } catch (error) {
      console.error('Failed to set API key:', error);
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.secretsClearKey();
      if (result.success) {
        setApiKeyExists(false);
        setApiKeyValue('');
        setMessage({ type: 'success', text: 'API key cleared successfully' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to clear API key' });
      }
    } catch (error) {
      console.error('Failed to clear API key:', error);
      setMessage({ type: 'error', text: 'Failed to clear API key' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="screen-placeholder">
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="screen-placeholder">
        <p>Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="settings-screen">
      <h1>Settings</h1>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <section className="settings-section">
        <h2>Output Path</h2>
        <div className="settings-field">
          <label>Output Root Path</label>
          <div className="input-group">
            <input
              type="text"
              value={config.outputRootPath || ''}
              readOnly
              placeholder="Not set"
              className="input-readonly"
            />
            <button onClick={handleSelectOutputPath} disabled={saving}>
              Browse...
            </button>
          </div>
          <p className="field-help">Where generated resumes and cover letters will be saved</p>
        </div>
      </section>

      <section className="settings-section">
        <h2>API Key</h2>
        <div className="settings-field">
          <label>OpenAI API Key</label>
          <div className="input-group">
            <input
              type="password"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder={apiKeyExists ? '••••••••••••' : 'Enter API key'}
              disabled={saving}
            />
            {apiKeyExists ? (
              <>
                <button onClick={handleSetApiKey} disabled={saving || !apiKeyValue.trim()}>
                  Update
                </button>
                <button onClick={handleClearApiKey} disabled={saving} className="button-danger">
                  Clear
                </button>
              </>
            ) : (
              <button onClick={handleSetApiKey} disabled={saving || !apiKeyValue.trim()}>
                Set
              </button>
            )}
          </div>
          <p className="field-help">
            {apiKeyExists
              ? 'API key is stored securely in your system keychain'
              : 'API key is required to generate resumes'}
          </p>
        </div>
        <div className="settings-field">
          <label>API base URL (optional)</label>
          <input
            type="url"
            value={config.openaiBaseURL || ''}
            onChange={(e) => setConfig({ ...config, openaiBaseURL: e.target.value.trim() || undefined })}
            placeholder="https://api.openai.com/v1"
            disabled={saving}
          />
          <p className="field-help">
            Leave empty for default. Set to a proxy or OpenAI-compatible endpoint if you get connection errors.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Model Configuration</h2>
        <div className="settings-field">
          <label>JD Extraction Model</label>
          <input
            type="text"
            value={config.jdExtractionModel || ''}
            onChange={(e) => setConfig({ ...config, jdExtractionModel: e.target.value })}
            placeholder="e.g., gpt-4o-mini"
            disabled={saving}
          />
        </div>
        <div className="settings-field">
          <label>Resume Payload Model</label>
          <input
            type="text"
            value={config.resumePayloadModel || ''}
            onChange={(e) => setConfig({ ...config, resumePayloadModel: e.target.value })}
            placeholder="e.g., gpt-4o"
            disabled={saving}
          />
        </div>
        <div className="settings-field">
          <label>Fallback Model</label>
          <input
            type="text"
            value={config.fallbackModel || ''}
            onChange={(e) => setConfig({ ...config, fallbackModel: e.target.value })}
            placeholder="e.g., gpt-3.5-turbo"
            disabled={saving}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2>Retry & Fallback</h2>
        <div className="settings-field">
          <label>
            Retry Count (Call A)
            <input
              type="number"
              min="0"
              max="5"
              value={config.retryCountCallA}
              onChange={(e) =>
                setConfig({ ...config, retryCountCallA: parseInt(e.target.value, 10) || 0 })
              }
              disabled={saving}
            />
          </label>
        </div>
        <div className="settings-field">
          <label>
            Retry Count (Call B)
            <input
              type="number"
              min="0"
              max="5"
              value={config.retryCountCallB}
              onChange={(e) =>
                setConfig({ ...config, retryCountCallB: parseInt(e.target.value, 10) || 0 })
              }
              disabled={saving}
            />
          </label>
        </div>
        <div className="settings-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.fallbackEnabled}
              onChange={(e) => setConfig({ ...config, fallbackEnabled: e.target.checked })}
              disabled={saving}
            />
            Enable Fallback Model
          </label>
        </div>
      </section>

      <div className="settings-actions">
        <button onClick={handleSaveConfig} disabled={saving} className="button-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

export default SettingsScreen;
