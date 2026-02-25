import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
function HistoryScreen() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);
    const [counts, setCounts] = useState(null);
    useEffect(() => {
        loadHistory();
        loadCounts();
    }, []);
    const loadCounts = async () => {
        try {
            const res = await window.electronAPI.historyGetCounts();
            if (res.success && res.total !== undefined && res.today !== undefined) {
                setCounts({ total: res.total, today: res.today });
            }
        }
        catch {
            setCounts(null);
        }
    };
    const loadHistory = async (query) => {
        setLoading(true);
        setError(null);
        try {
            const response = await window.electronAPI.historyList(query);
            if (response.success && response.results) {
                setResults(response.results);
            }
            else {
                setError(response.error || 'Failed to load history');
            }
        }
        catch (err) {
            setError('Failed to load history');
            console.error(err);
        }
        finally {
            setLoading(false);
        }
        loadCounts();
    };
    const handleSearch = () => {
        const query = searchQuery.trim()
            ? { keyword: searchQuery.trim() }
            : undefined;
        loadHistory(query);
    };
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    return (_jsxs("div", { className: "history-screen", children: [_jsx("h1", { children: "History" }), counts !== null && (_jsxs("p", { className: "history-stats", children: [_jsxs("span", { className: "history-stat-total", children: [counts.total, " resume", counts.total !== 1 ? 's' : '', " generated in total"] }), _jsx("span", { className: "history-stat-sep", children: " \u00B7 " }), _jsxs("span", { className: "history-stat-today", children: [counts.today, " today"] })] })), _jsxs("div", { className: "history-search", children: [_jsx("input", { type: "text", placeholder: "Search by company, role, or keywords...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onKeyPress: (e) => e.key === 'Enter' && handleSearch(), className: "search-input" }), _jsx("button", { onClick: handleSearch, className: "button-primary", children: "Search" }), _jsx("button", { onClick: () => { setSearchQuery(''); loadHistory(); }, className: "button-secondary", children: "Clear" })] }), error && _jsx("div", { className: "message message-error", children: error }), loading ? (_jsx("div", { className: "screen-placeholder", children: _jsx("p", { children: "Loading history..." }) })) : results.length === 0 ? (_jsxs("div", { className: "screen-placeholder", children: [_jsx("h2", { children: "No applications found" }), _jsx("p", { children: "Your application history will appear here after generating resumes." })] })) : (_jsx("div", { className: "history-list", children: results.map(({ job, generation, profileName }) => (_jsxs("div", { className: "history-item", children: [_jsxs("div", { className: "history-item-header", children: [_jsxs("div", { className: "history-item-title", children: [_jsx("h3", { children: job.company_name || 'Unknown Company' }), _jsx("span", { className: "history-item-role", children: job.job_title || 'Unknown Role' }), profileName && (_jsxs("span", { className: "history-item-profile", children: ["Profile: ", profileName] }))] }), _jsxs("div", { className: "history-item-meta", children: [_jsx("span", { className: "history-item-date", children: formatDate(job.created_at) }), generation && (_jsx("span", { className: `status-badge status-${generation.status}`, children: generation.status }))] })] }), job.contact_email && (_jsxs("div", { className: "history-item-contact", children: [_jsx("strong", { children: "Contact:" }), " ", job.contact_email, job.contact_phone && ` | ${job.contact_phone}`] })), generation && generation.output_dir && (_jsxs("div", { className: "history-item-actions", children: [_jsx("button", { onClick: async () => {
                                        try {
                                            await window.electronAPI.filesOpenFolder(generation.output_dir);
                                        }
                                        catch (err) {
                                            console.error('Failed to open folder:', err);
                                            alert('Failed to open folder');
                                        }
                                    }, className: "button-link", children: "Open Folder" }), generation.resume_pdf_path && (_jsx("button", { onClick: async () => {
                                        try {
                                            await window.electronAPI.filesOpenFile(generation.resume_pdf_path);
                                        }
                                        catch (err) {
                                            console.error('Failed to open file:', err);
                                            alert('Failed to open file');
                                        }
                                    }, className: "button-link", style: { marginLeft: '12px' }, children: "Open Resume PDF" })), generation.cover_pdf_path && (_jsx("button", { onClick: async () => {
                                        try {
                                            await window.electronAPI.filesOpenFile(generation.cover_pdf_path);
                                        }
                                        catch (err) {
                                            console.error('Failed to open file:', err);
                                            alert('Failed to open file');
                                        }
                                    }, className: "button-link", style: { marginLeft: '12px' }, children: "Open Cover PDF" })), generation.qa_pdf_path && (_jsx("button", { onClick: async () => {
                                        try {
                                            await window.electronAPI.filesOpenFile(generation.qa_pdf_path);
                                        }
                                        catch (err) {
                                            console.error('Failed to open file:', err);
                                            alert('Failed to open file');
                                        }
                                    }, className: "button-link", style: { marginLeft: '12px' }, children: "Open QA PDF" }))] }))] }, generation?.generation_id ?? job.job_id))) }))] }));
}
export default HistoryScreen;
