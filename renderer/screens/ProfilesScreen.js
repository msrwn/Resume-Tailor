import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
function ProfilesScreen() {
    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('base');
    const [profileName, setProfileName] = useState('');
    const [baseResumeText, setBaseResumeText] = useState('');
    const [templateHtml, setTemplateHtml] = useState('');
    const [prompts, setPrompts] = useState([]);
    const [promptName, setPromptName] = useState('');
    const [promptText, setPromptText] = useState('');
    const [editingPromptId, setEditingPromptId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    useEffect(() => {
        loadProfiles();
    }, []);
    useEffect(() => {
        if (selectedProfile) {
            setProfileName(selectedProfile.name);
            setBaseResumeText(selectedProfile.base_resume_text ?? '');
            setTemplateHtml(selectedProfile.template_html);
            setEditing(false);
            setValidationResult(null);
            loadPrompts(selectedProfile.profile_id);
        }
    }, [selectedProfile]);
    const loadProfiles = async () => {
        setLoading(true);
        setError(null);
        try {
            await window.electronAPI.dbInit();
            const listResponse = await window.electronAPI.profilesList();
            if (listResponse.success && listResponse.profiles) {
                setProfiles(listResponse.profiles);
                if (listResponse.profiles.length > 0 && !selectedProfile) {
                    setSelectedProfile(listResponse.profiles[0]);
                }
            }
            else {
                setError(listResponse.error || 'Failed to load profiles');
            }
        }
        catch (err) {
            setError('Database not available. Please ensure better-sqlite3 is compiled.');
            console.error('Failed to load profiles:', err);
        }
        finally {
            setLoading(false);
        }
    };
    const loadPrompts = async (profileId) => {
        try {
            const res = await window.electronAPI.profilePromptsList(profileId);
            if (res.success && res.prompts) {
                setPrompts(res.prompts);
            }
            else {
                setPrompts([]);
            }
            setEditingPromptId(null);
            setPromptName('');
            setPromptText('');
        }
        catch (err) {
            console.error('Failed to load profile prompts:', err);
            setPrompts([]);
        }
    };
    const handleCreateNew = async () => {
        if (!selectedProfile) {
            alert('Please select a profile to clone');
            return;
        }
        try {
            const newName = `${selectedProfile.name} (Copy)`;
            const response = await window.electronAPI.profilesCreate({
                name: newName,
                rules_text: selectedProfile.rules_text,
                base_resume_text: selectedProfile.base_resume_text,
                template_html: selectedProfile.template_html,
                is_default: false,
            });
            if (response.success && response.profile) {
                await loadProfiles();
                setSelectedProfile(response.profile);
            }
            else {
                alert(response.error || 'Failed to create profile');
            }
        }
        catch (err) {
            alert('Failed to create profile');
            console.error(err);
        }
    };
    const handleSave = async () => {
        if (!selectedProfile)
            return;
        setSaving(true);
        try {
            const response = await window.electronAPI.profilesUpdate(selectedProfile.profile_id, {
                name: profileName,
                // rules_text is deprecated and ignored by the pipeline; keep existing value.
                rules_text: selectedProfile.rules_text,
                base_resume_text: baseResumeText,
                template_html: templateHtml,
            });
            if (response.success && response.profile) {
                await loadProfiles();
                setSelectedProfile(response.profile);
                setEditing(false);
                setValidationResult(null);
                alert('Profile saved successfully');
            }
            else {
                alert(response.error || 'Failed to save profile');
            }
        }
        catch (err) {
            alert('Failed to save profile');
            console.error(err);
        }
        finally {
            setSaving(false);
        }
    };
    const handleSetDefault = async () => {
        if (!selectedProfile)
            return;
        try {
            const response = await window.electronAPI.profilesSetDefault(selectedProfile.profile_id);
            if (response.success) {
                await loadProfiles();
                alert('Default profile updated');
            }
            else {
                alert(response.error || 'Failed to set default profile');
            }
        }
        catch (err) {
            alert('Failed to set default profile');
            console.error(err);
        }
    };
    const handleArchive = async () => {
        if (!selectedProfile)
            return;
        if (!confirm(`Are you sure you want to archive "${selectedProfile.name}"?`))
            return;
        try {
            const response = await window.electronAPI.profilesArchive(selectedProfile.profile_id);
            if (response.success) {
                await loadProfiles();
                setSelectedProfile(null);
                alert('Profile archived');
            }
            else {
                alert(response.error || 'Failed to archive profile');
            }
        }
        catch (err) {
            alert('Failed to archive profile');
            console.error(err);
        }
    };
    const handleValidate = async () => {
        try {
            const response = await window.electronAPI.profilesValidate({
                // rules_text is deprecated; send a non-empty placeholder to satisfy older handlers.
                rules_text: 'deprecated',
                template_html: templateHtml,
            });
            if (response.success) {
                setValidationResult({
                    valid: response.valid || false,
                    errors: response.errors || [],
                });
                if (response.valid) {
                    alert('Validation passed! ✓');
                }
            }
            else {
                alert(response.error || 'Validation failed');
            }
        }
        catch (err) {
            alert('Failed to validate profile');
            console.error(err);
        }
    };
    const handleCancel = () => {
        if (selectedProfile) {
            setProfileName(selectedProfile.name);
            setBaseResumeText(selectedProfile.base_resume_text ?? '');
            setTemplateHtml(selectedProfile.template_html);
        }
        setEditing(false);
        setValidationResult(null);
    };
    const handlePromptEdit = (p) => {
        setEditingPromptId(p.prompt_id);
        setPromptName(p.name);
        setPromptText(p.prompt_text);
    };
    const handlePromptNew = () => {
        setEditingPromptId(null);
        setPromptName('');
        setPromptText('');
        setActiveTab('prompts');
    };
    const handlePromptSave = async () => {
        if (!selectedProfile)
            return;
        if (!promptName.trim()) {
            alert('Prompt name is required');
            return;
        }
        if (!promptText.trim()) {
            alert('Prompt text is required');
            return;
        }
        try {
            if (editingPromptId) {
                const res = await window.electronAPI.profilePromptsUpdate(editingPromptId, {
                    name: promptName.trim(),
                    prompt_text: promptText,
                });
                if (!res.success) {
                    alert(res.error || 'Failed to update prompt');
                }
            }
            else {
                const res = await window.electronAPI.profilePromptsCreate({
                    profile_id: selectedProfile.profile_id,
                    name: promptName.trim(),
                    prompt_text: promptText,
                });
                if (!res.success) {
                    alert(res.error || 'Failed to create prompt');
                }
            }
            await loadPrompts(selectedProfile.profile_id);
        }
        catch (err) {
            console.error('Failed to save prompt', err);
            alert('Failed to save prompt');
        }
    };
    const handlePromptArchive = async (promptId) => {
        if (!confirm('Archive this prompt?'))
            return;
        try {
            const res = await window.electronAPI.profilePromptsArchive(promptId);
            if (!res.success) {
                alert(res.error || 'Failed to archive prompt');
            }
            else if (selectedProfile) {
                await loadPrompts(selectedProfile.profile_id);
            }
        }
        catch (err) {
            console.error('Failed to archive prompt', err);
            alert('Failed to archive prompt');
        }
    };
    if (loading) {
        return (_jsx("div", { className: "screen-placeholder", children: _jsx("p", { children: "Loading profiles..." }) }));
    }
    if (error) {
        return (_jsxs("div", { className: "profiles-screen", children: [_jsx("h1", { children: "Profiles" }), _jsxs("div", { className: "message message-error", children: [_jsx("strong", { children: "Database Error:" }), " ", error, _jsx("br", {}), _jsxs("small", { children: ["To enable database features, install Visual Studio Build Tools with C++ workload, then run: ", _jsx("code", { children: "npm rebuild better-sqlite3" })] })] })] }));
    }
    return (_jsxs("div", { className: "profiles-screen-full", children: [_jsxs("div", { className: "profiles-header", children: [_jsx("h1", { children: "Profiles" }), _jsx("button", { onClick: handleCreateNew, className: "button-primary", disabled: !selectedProfile, children: "New (Clone)" })] }), _jsxs("div", { className: "profiles-layout", children: [_jsxs("div", { className: "profiles-list-panel", children: [_jsx("h2", { children: "Profiles" }), profiles.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No profiles found" }) })) : (_jsx("div", { className: "profiles-list", children: profiles.map((profile) => (_jsxs("div", { className: `profile-list-item ${selectedProfile?.profile_id === profile.profile_id ? 'active' : ''}`, onClick: () => setSelectedProfile(profile), children: [_jsxs("div", { className: "profile-list-header", children: [_jsx("span", { className: "profile-list-name", children: profile.name }), profile.is_default && (_jsx("span", { className: "badge badge-default", children: "Default" }))] }), _jsxs("div", { className: "profile-list-meta", children: ["Updated: ", new Date(profile.updated_at).toLocaleDateString()] })] }, profile.profile_id))) }))] }), _jsx("div", { className: "profiles-editor-panel", children: selectedProfile ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "editor-header", children: [_jsxs("div", { className: "profile-name-field", children: [_jsx("label", { htmlFor: "profile-name-input", className: "profile-name-label", children: "Profile name" }), _jsx("input", { id: "profile-name-input", type: "text", value: profileName, onChange: (e) => {
                                                        setProfileName(e.target.value);
                                                        setEditing(true);
                                                    }, onFocus: () => setEditing(true), className: "profile-name-input", placeholder: "Enter profile name" })] }), _jsx("div", { className: "editor-actions", children: editing ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleSave, disabled: saving, className: "button-primary", children: saving ? 'Saving...' : 'Save' }), _jsx("button", { onClick: handleCancel, disabled: saving, className: "button-secondary", children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setEditing(true), className: "button-primary", children: "Edit" }), _jsx("button", { onClick: handleValidate, className: "button-secondary", children: "Validate" }), !selectedProfile.is_default && (_jsx("button", { onClick: handleSetDefault, className: "button-secondary", children: "Set Default" })), !selectedProfile.archived_at && (_jsx("button", { onClick: handleArchive, className: "button-danger", children: "Archive" }))] })) })] }), validationResult && (_jsx("div", { className: `message ${validationResult.valid ? 'message-success' : 'message-error'}`, children: validationResult.valid ? ('✓ Validation passed') : (_jsxs("div", { children: [_jsx("strong", { children: "Validation failed:" }), _jsx("ul", { style: { marginTop: '8px', marginLeft: '20px' }, children: validationResult.errors.map((err, i) => (_jsx("li", { children: err }, i))) })] })) })), _jsxs("div", { className: "editor-tabs", children: [_jsx("button", { className: `tab-button ${activeTab === 'base' ? 'active' : ''}`, onClick: () => setActiveTab('base'), children: "Base Resume" }), _jsx("button", { className: `tab-button ${activeTab === 'template' ? 'active' : ''}`, onClick: () => setActiveTab('template'), children: "Resume Template" }), _jsx("button", { className: `tab-button ${activeTab === 'prompts' ? 'active' : ''}`, onClick: () => setActiveTab('prompts'), children: "Prompts" })] }), _jsxs("div", { className: "editor-content", children: [activeTab === 'base' && (_jsx("textarea", { value: baseResumeText, onChange: (e) => {
                                                setBaseResumeText(e.target.value);
                                                setEditing(true);
                                            }, className: "editor-textarea", placeholder: "Paste your full base resume here (plain text)...", rows: 20 })), activeTab === 'template' && (_jsx("textarea", { value: templateHtml, onChange: (e) => {
                                                setTemplateHtml(e.target.value);
                                                setEditing(true);
                                            }, className: "editor-textarea", placeholder: "Enter HTML template here...", rows: 20 })), activeTab === 'prompts' && (_jsxs("div", { className: "prompts-editor", children: [_jsxs("div", { className: "prompts-list", children: [_jsxs("div", { className: "prompts-list-header", children: [_jsx("h3", { children: "Prompts" }), _jsx("button", { className: "button-secondary", onClick: handlePromptNew, children: "New Prompt" })] }), prompts.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No prompts for this profile yet." }) })) : (_jsx("ul", { className: "prompts-list-items", children: prompts.map((p) => (_jsxs("li", { className: `prompt-item ${editingPromptId === p.prompt_id ? 'active' : ''}`, children: [_jsxs("div", { className: "prompt-item-main", onClick: () => handlePromptEdit(p), children: [_jsx("span", { className: "prompt-item-name", children: p.name }), _jsxs("span", { className: "prompt-item-updated", children: ["Updated: ", new Date(p.updated_at).toLocaleDateString()] })] }), _jsx("button", { className: "button-link button-small", onClick: () => handlePromptArchive(p.prompt_id), children: "Archive" })] }, p.prompt_id))) }))] }), _jsxs("div", { className: "prompts-editor-form", children: [_jsxs("label", { className: "prompts-label", children: ["Prompt name", _jsx("input", { type: "text", value: promptName, onChange: (e) => setPromptName(e.target.value), className: "prompts-name-input", placeholder: "e.g. Mobile-focused, Web platform" })] }), _jsxs("label", { className: "prompts-label", children: ["Prompt text", _jsx("textarea", { value: promptText, onChange: (e) => setPromptText(e.target.value), className: "editor-textarea", placeholder: "Enter the full prompt/instructions for this profile & role...", rows: 14 })] }), _jsx("div", { className: "prompts-actions", children: _jsx("button", { className: "button-primary", onClick: handlePromptSave, children: editingPromptId ? 'Save Prompt' : 'Create Prompt' }) })] })] }))] }), _jsx("div", { className: "editor-footer", children: _jsxs("div", { className: "editor-info", children: [_jsxs("span", { children: ["Rules Hash: ", selectedProfile.rules_hash.substring(0, 8), "..."] }), _jsxs("span", { children: ["Template Hash: ", selectedProfile.template_hash.substring(0, 8), "..."] })] }) })] })) : (_jsx("div", { className: "screen-placeholder", children: _jsx("p", { children: "Select a profile to edit" }) })) })] })] }));
}
export default ProfilesScreen;
