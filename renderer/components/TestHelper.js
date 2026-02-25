import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
/**
 * Test helper component - shows app state for debugging
 * Only visible in development mode
 */
function TestHelper() {
    const [appDataPath, setAppDataPath] = useState('');
    const [version, setVersion] = useState('');
    const [config, setConfig] = useState(null);
    const [hasApiKey, setHasApiKey] = useState(false);
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
        }
        catch (error) {
            console.error('Failed to load app info:', error);
        }
    };
    // Only show in development
    if (process.env.NODE_ENV === 'production') {
        return null;
    }
    return (_jsxs("div", { style: {
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
        }, onClick: () => {
            const details = {
                version,
                appDataPath,
                config,
                hasApiKey,
                databasePath: `${appDataPath}\\app.db`,
            };
            console.log('App State:', details);
            alert(JSON.stringify(details, null, 2));
        }, title: "Click to see details in console", children: [_jsx("div", { style: { fontWeight: 'bold', marginBottom: '8px' }, children: "\uD83E\uDDEA Test Helper" }), _jsxs("div", { children: ["Version: ", version] }), _jsxs("div", { children: ["API Key: ", hasApiKey ? '✅ Set' : '❌ Not Set'] }), _jsxs("div", { children: ["Output Path: ", config?.outputRootPath ? '✅ Set' : '❌ Not Set'] }), _jsx("div", { style: { marginTop: '8px', fontSize: '10px', opacity: 0.7 }, children: "Click for details" })] }));
}
export default TestHelper;
