import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import GenerateScreen from './screens/GenerateScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfilesScreen from './screens/ProfilesScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChangelogScreen from './screens/ChangelogScreen';
import TestHelper from './components/TestHelper';
function App() {
    const [currentScreen, setCurrentScreen] = useState('generate');
    const [version, setVersion] = useState('');
    useEffect(() => {
        window.electronAPI.getVersion().then(setVersion).catch(() => setVersion('—'));
    }, []);
    return (_jsxs("div", { className: "app", children: [_jsxs("nav", { className: "sidebar", children: [_jsxs("div", { className: "nav-header", children: [_jsx("img", { src: "./icon.ico", alt: "", className: "nav-header-icon" }), _jsxs("div", { className: "nav-header-text", children: [_jsx("h1", { className: "nav-header-title", children: "Resume Tailor" }), _jsxs("div", { className: "nav-header-meta", children: [_jsxs("span", { className: "nav-version", children: ["v", version] }), _jsx("div", { className: `mode-badge ${process.env.NODE_ENV === 'development' ? 'mode-dev' : 'mode-prod'}`, children: process.env.NODE_ENV === 'development' ? 'DEV' : 'PROD' })] })] })] }), _jsxs("ul", { className: "nav-list", children: [_jsx("li", { children: _jsx("button", { className: currentScreen === 'generate' ? 'active' : '', onClick: () => setCurrentScreen('generate'), children: "Generate" }) }), _jsx("li", { children: _jsx("button", { className: currentScreen === 'history' ? 'active' : '', onClick: () => setCurrentScreen('history'), children: "History" }) }), _jsx("li", { children: _jsx("button", { className: currentScreen === 'profiles' ? 'active' : '', onClick: () => setCurrentScreen('profiles'), children: "Profiles" }) }), _jsx("li", { children: _jsx("button", { className: currentScreen === 'settings' ? 'active' : '', onClick: () => setCurrentScreen('settings'), children: "Settings" }) }), _jsx("li", { children: _jsx("button", { className: currentScreen === 'changelog' ? 'active' : '', onClick: () => setCurrentScreen('changelog'), children: "Changelog" }) })] })] }), _jsxs("main", { className: "main-content", children: [currentScreen === 'generate' && _jsx(GenerateScreen, {}), currentScreen === 'history' && _jsx(HistoryScreen, {}), currentScreen === 'profiles' && _jsx(ProfilesScreen, {}), currentScreen === 'settings' && _jsx(SettingsScreen, {}), currentScreen === 'changelog' && _jsx(ChangelogScreen, {})] }), _jsx(TestHelper, {})] }));
}
export default App;
