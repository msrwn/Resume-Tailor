import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
function SettingsScreen() {
    const [config, setConfig] = useState(null);
    const [apiKeyExists, setApiKeyExists] = useState(false);
    const [apiKeyValue, setApiKeyValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
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
        }
        catch (error) {
            console.error('Failed to load settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
        }
        finally {
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
        }
        catch (error) {
            console.error('Failed to select folder:', error);
            setMessage({ type: 'error', text: 'Failed to select folder' });
        }
    };
    const handleSaveConfig = async () => {
        if (!config)
            return;
        await saveConfig(config);
    };
    const saveConfig = async (newConfig) => {
        setSaving(true);
        setMessage(null);
        try {
            const result = await window.electronAPI.configSet(newConfig);
            if (result.success) {
                setConfig(newConfig);
                setMessage({ type: 'success', text: 'Settings saved successfully' });
            }
            else {
                setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
            }
        }
        catch (error) {
            console.error('Failed to save config:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        }
        finally {
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
            }
            else {
                setMessage({ type: 'error', text: result.error || 'Failed to save API key' });
            }
        }
        catch (error) {
            console.error('Failed to set API key:', error);
            setMessage({ type: 'error', text: 'Failed to save API key' });
        }
        finally {
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
            }
            else {
                setMessage({ type: 'error', text: result.error || 'Failed to clear API key' });
            }
        }
        catch (error) {
            console.error('Failed to clear API key:', error);
            setMessage({ type: 'error', text: 'Failed to clear API key' });
        }
        finally {
            setSaving(false);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "screen-placeholder", children: _jsx("p", { children: "Loading settings..." }) }));
    }
    if (!config) {
        return (_jsx("div", { className: "screen-placeholder", children: _jsx("p", { children: "Failed to load settings" }) }));
    }
    return (_jsxs("div", { className: "settings-screen", children: [_jsx("h1", { children: "Settings" }), message && (_jsx("div", { className: `message message-${message.type}`, children: message.text })), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { children: "Output Path" }), _jsxs("div", { className: "settings-field", children: [_jsx("label", { children: "Output Root Path" }), _jsxs("div", { className: "input-group", children: [_jsx("input", { type: "text", value: config.outputRootPath || '', readOnly: true, placeholder: "Not set", className: "input-readonly" }), _jsx("button", { onClick: handleSelectOutputPath, disabled: saving, children: "Browse..." })] }), _jsx("p", { className: "field-help", children: "Where generated resumes and cover letters will be saved" })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { children: "API Key" }), _jsxs("div", { className: "settings-field", children: [_jsx("label", { children: "OpenAI API Key" }), _jsxs("div", { className: "input-group", children: [_jsx("input", { type: "password", value: apiKeyValue, onChange: (e) => setApiKeyValue(e.target.value), placeholder: apiKeyExists ? '••••••••••••' : 'Enter API key', disabled: saving }), apiKeyExists ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleSetApiKey, disabled: saving || !apiKeyValue.trim(), children: "Update" }), _jsx("button", { onClick: handleClearApiKey, disabled: saving, className: "button-danger", children: "Clear" })] })) : (_jsx("button", { onClick: handleSetApiKey, disabled: saving || !apiKeyValue.trim(), children: "Set" }))] }), _jsx("p", { className: "field-help", children: apiKeyExists
                                    ? 'API key is stored securely in your system keychain'
                                    : 'API key is required to generate resumes' })] }), _jsxs("div", { className: "settings-field", children: [_jsx("label", { children: "API base URL (optional)" }), _jsx("input", { type: "url", value: config.openaiBaseURL || '', onChange: (e) => setConfig({ ...config, openaiBaseURL: e.target.value.trim() || undefined }), placeholder: "https://api.openai.com/v1", disabled: saving }), _jsx("p", { className: "field-help", children: "Leave empty for default. Set to a proxy or OpenAI-compatible endpoint if you get connection errors." })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { children: "Model Configuration" }), _jsxs("div", { className: "settings-field", children: [_jsx("label", { children: "JD Extraction Model" }), _jsx("input", { type: "text", value: config.jdExtractionModel || '', onChange: (e) => setConfig({ ...config, jdExtractionModel: e.target.value }), placeholder: "e.g., gpt-4o-mini", disabled: saving })] }), _jsxs("div", { className: "settings-field", children: [_jsx("label", { children: "Resume Payload Model" }), _jsx("input", { type: "text", value: config.resumePayloadModel || '', onChange: (e) => setConfig({ ...config, resumePayloadModel: e.target.value }), placeholder: "e.g., gpt-4o", disabled: saving })] }), _jsxs("div", { className: "settings-field", children: [_jsx("label", { children: "Fallback Model" }), _jsx("input", { type: "text", value: config.fallbackModel || '', onChange: (e) => setConfig({ ...config, fallbackModel: e.target.value }), placeholder: "e.g., gpt-3.5-turbo", disabled: saving })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { children: "Retry & Fallback" }), _jsx("div", { className: "settings-field", children: _jsxs("label", { children: ["Retry Count (Call A)", _jsx("input", { type: "number", min: "0", max: "5", value: config.retryCountCallA, onChange: (e) => setConfig({ ...config, retryCountCallA: parseInt(e.target.value, 10) || 0 }), disabled: saving })] }) }), _jsx("div", { className: "settings-field", children: _jsxs("label", { children: ["Retry Count (Call B)", _jsx("input", { type: "number", min: "0", max: "5", value: config.retryCountCallB, onChange: (e) => setConfig({ ...config, retryCountCallB: parseInt(e.target.value, 10) || 0 }), disabled: saving })] }) }), _jsx("div", { className: "settings-field", children: _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: config.fallbackEnabled, onChange: (e) => setConfig({ ...config, fallbackEnabled: e.target.checked }), disabled: saving }), "Enable Fallback Model"] }) })] }), _jsx("div", { className: "settings-actions", children: _jsx("button", { onClick: handleSaveConfig, disabled: saving, className: "button-primary", children: saving ? 'Saving...' : 'Save Settings' }) })] }));
}
export default SettingsScreen;
