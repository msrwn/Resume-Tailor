import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
function ChangelogScreen() {
    const [content, setContent] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        window.electronAPI
            .getChangelog()
            .then((res) => {
            if (cancelled)
                return;
            if (res.success && res.content != null) {
                setContent(res.content);
                setError(null);
            }
            else {
                setContent(null);
                setError(res.error ?? 'Could not load changelog.');
            }
        })
            .catch((err) => {
            if (!cancelled) {
                setContent(null);
                setError(err instanceof Error ? err.message : 'Could not load changelog.');
            }
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return (_jsxs("div", { className: "changelog-screen", children: [_jsx("h1", { children: "Changelog" }), _jsx("p", { className: "screen-description", children: "Release history and notable changes." }), loading && _jsx("p", { className: "changelog-loading", children: "Loading\u2026" }), error && (_jsx("div", { className: "message message-error changelog-error", children: error })), !loading && !error && content != null && (_jsx("div", { className: "changelog-content", children: _jsx("pre", { className: "changelog-text", children: content }) }))] }));
}
export default ChangelogScreen;
