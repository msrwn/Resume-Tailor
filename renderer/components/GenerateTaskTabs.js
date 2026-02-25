import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function GenerateTaskTabs({ activeTaskIndex, maxTasks, getBadgeStatus, onSelectTask, }) {
    return (_jsx("div", { className: "generate-task-tabs", role: "tablist", "aria-label": "Tasks", children: Array.from({ length: maxTasks }, (_, i) => i + 1).map((n) => {
            const badge = getBadgeStatus(n);
            return (_jsxs("button", { type: "button", role: "tab", "aria-selected": activeTaskIndex === n, "aria-controls": "generate-task-panel", id: `generate-task-tab-${n}`, className: `generate-task-tab ${activeTaskIndex === n ? 'active' : ''}`, onClick: () => onSelectTask(n), title: n === 10 ? 'Task 10 (Ctrl+0)' : `Task ${n} (Ctrl+${n})`, children: [_jsxs("span", { className: "generate-task-tab-label", children: ["Task ", n] }), badge === 'loading' && (_jsx("span", { className: "generate-task-badge generate-task-badge-loading", "aria-hidden": true, children: "..." })), badge === 'success' && (_jsx("span", { className: "generate-task-badge generate-task-badge-success", "aria-hidden": true, children: "\u2713" })), badge === 'error' && (_jsx("span", { className: "generate-task-badge generate-task-badge-error", "aria-hidden": true, children: "!" }))] }, n));
        }) }));
}
