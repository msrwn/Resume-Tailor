import { useState, useEffect } from 'react';
import type { Profile, ProfilePrompt } from '@shared/types';
import { useModal } from '../context/ModalContext';

type EditorTab = 'base' | 'template' | 'prompts';

function ProfilesScreen() {
  const modal = useModal();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('prompts');
  const [profileName, setProfileName] = useState('');
  const [baseResumeText, setBaseResumeText] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [saveBanner, setSaveBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [prompts, setPrompts] = useState<ProfilePrompt[]>([]);
  const [promptName, setPromptName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);

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
      } else {
        setError(listResponse.error || 'Failed to load profiles');
      }
    } catch (err) {
      setError('Database not available. Please ensure better-sqlite3 is compiled.');
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async (profileId: string) => {
    try {
      const res = await window.electronAPI.profilePromptsList(profileId);
      if (res.success && res.prompts) {
        setPrompts(res.prompts);
      } else {
        setPrompts([]);
      }
      setEditingPromptId(null);
      setPromptName('');
      setPromptText('');
    } catch (err) {
      console.error('Failed to load profile prompts:', err);
      setPrompts([]);
    }
  };

  const handleCreateNew = async () => {
    if (!selectedProfile) {
      await modal.alert('Please select a profile to clone');
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
      } else {
        await modal.alert(response.error || 'Failed to create profile');
      }
    } catch (err) {
      await modal.alert('Failed to create profile');
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!selectedProfile) return;

    setSaveBanner(null);
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
        setSaveBanner({ type: 'success', message: 'Profile saved successfully' });
      } else {
        setSaveBanner({ type: 'error', message: response.error || 'Failed to save profile' });
      }
    } catch (err) {
      setSaveBanner({ type: 'error', message: 'Failed to save profile' });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    if (!selectedProfile) return;

    try {
      const response = await window.electronAPI.profilesSetDefault(selectedProfile.profile_id);
      if (response.success) {
        await loadProfiles();
        await modal.alert('Default profile updated');
      } else {
        await modal.alert(response.error || 'Failed to set default profile');
      }
    } catch (err) {
      await modal.alert('Failed to set default profile');
      console.error(err);
    }
  };

  const handleArchive = async () => {
    if (!selectedProfile) return;
    const ok = await modal.confirm(`Are you sure you want to archive "${selectedProfile.name}"?`);
    if (!ok) return;

    try {
      const response = await window.electronAPI.profilesArchive(selectedProfile.profile_id);
      if (response.success) {
        await loadProfiles();
        setSelectedProfile(null);
        await modal.alert('Profile archived');
      } else {
        await modal.alert(response.error || 'Failed to archive profile');
      }
    } catch (err) {
      await modal.alert('Failed to archive profile');
      console.error(err);
    }
  };

  const handleDownload = async () => {
    if (!selectedProfile) return;
    try {
      const response = await window.electronAPI.profilesDownload(selectedProfile.profile_id);
      if (response.canceled) return;
      if (response.success) {
        await modal.alert(
          `Profile saved to folder.\n\nFiles: base resume (.txt), template (.html), and one prompt file per prompt (.txt).`
        );
      } else {
        await modal.alert(response.error || 'Failed to download profile');
      }
    } catch (err) {
      await modal.alert('Failed to download profile');
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
          await modal.alert('Validation passed! ✓');
        }
      } else {
        await modal.alert(response.error || 'Validation failed');
      }
    } catch (err) {
      await modal.alert('Failed to validate profile');
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

  const handlePromptEdit = (p: ProfilePrompt) => {
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
    if (!selectedProfile) return;
    if (!promptName.trim()) {
      await modal.alert('Prompt name is required');
      return;
    }
    if (!promptText.trim()) {
      await modal.alert('Prompt text is required');
      return;
    }
    try {
      if (editingPromptId) {
        const res = await window.electronAPI.profilePromptsUpdate(editingPromptId, {
          name: promptName.trim(),
          prompt_text: promptText,
        });
        if (!res.success) {
          await modal.alert(res.error || 'Failed to update prompt');
        }
      } else {
        const res = await window.electronAPI.profilePromptsCreate({
          profile_id: selectedProfile.profile_id,
          name: promptName.trim(),
          prompt_text: promptText,
        });
        if (!res.success) {
          await modal.alert(res.error || 'Failed to create prompt');
        }
      }
      await loadPrompts(selectedProfile.profile_id);
    } catch (err) {
      console.error('Failed to save prompt', err);
      await modal.alert('Failed to save prompt');
    }
  };

  const handlePromptArchive = async (promptId: string) => {
    const ok = await modal.confirm('Archive this prompt?');
    if (!ok) return;
    try {
      const res = await window.electronAPI.profilePromptsArchive(promptId);
      if (!res.success) {
        await modal.alert(res.error || 'Failed to archive prompt');
      } else if (selectedProfile) {
        await loadPrompts(selectedProfile.profile_id);
      }
    } catch (err) {
      console.error('Failed to archive prompt', err);
      await modal.alert('Failed to archive prompt');
    }
  };

  if (loading) {
    return (
      <div className="screen-placeholder">
        <p>Loading profiles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profiles-screen">
        <h1>Profiles</h1>
        <div className="message message-error">
          <strong>Database Error:</strong> {error}
          <br />
          <small>
            To enable database features, install Visual Studio Build Tools with C++ workload,
            then run: <code>npm rebuild better-sqlite3</code>
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="profiles-screen-full">
      <div className="profiles-header">
        <h1>Profiles</h1>
        <button onClick={handleCreateNew} className="button-primary" disabled={!selectedProfile}>
          New (Clone)
        </button>
      </div>

      <div className="profiles-layout">
        {/* Left: Profile List */}
        <div className="profiles-list-panel">
          <h2>Profiles</h2>
          {profiles.length === 0 ? (
            <div className="empty-state">
              <p>No profiles found</p>
            </div>
          ) : (
            <div className="profiles-list">
              {profiles.map((profile) => (
                <div
                  key={profile.profile_id}
                  className={`profile-list-item ${
                    selectedProfile?.profile_id === profile.profile_id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedProfile(profile)}
                >
                  <div className="profile-list-header">
                    <span className="profile-list-name">{profile.name}</span>
                    {profile.is_default && (
                      <span className="badge badge-default">Default</span>
                    )}
                  </div>
                  <div className="profile-list-meta">
                    Updated: {new Date(profile.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Profile Editor */}
        <div className="profiles-editor-panel">
          {selectedProfile ? (
            <>
              <div className="editor-header">
                <div className="profile-name-field">
                  <label htmlFor="profile-name-input" className="profile-name-label">
                    Profile name
                  </label>
                  <input
                    id="profile-name-input"
                    type="text"
                    value={profileName}
                    onChange={(e) => {
                      setProfileName(e.target.value);
                      setEditing(true);
                    }}
                    onFocus={() => setEditing(true)}
                    className="profile-name-input"
                    placeholder="Enter profile name"
                  />
                </div>
                <div className="editor-actions">
                  {editing ? (
                    <>
                      <button onClick={handleSave} disabled={saving} className="button-primary">
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={handleCancel} disabled={saving} className="button-secondary">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditing(true)} className="button-primary">
                        Edit
                      </button>
                      <button onClick={handleValidate} className="button-secondary">
                        Validate
                      </button>
                      <button onClick={handleDownload} className="button-secondary" title="Download base resume, template, and prompts as text files">
                        Download
                      </button>
                      {!selectedProfile.is_default && (
                        <button onClick={handleSetDefault} className="button-secondary">
                          Set Default
                        </button>
                      )}
                      {!selectedProfile.archived_at && (
                        <button onClick={handleArchive} className="button-danger">
                          Archive
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {saveBanner && (
                <div className={`message ${saveBanner.type === 'success' ? 'message-success' : 'message-error'}`}>
                  {saveBanner.message}
                </div>
              )}

              {validationResult && (
                <div
                  className={`message ${
                    validationResult.valid ? 'message-success' : 'message-error'
                  }`}
                >
                  {validationResult.valid ? (
                    '✓ Validation passed'
                  ) : (
                    <div>
                      <strong>Validation failed:</strong>
                      <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="editor-tabs">
                <button
                  className={`tab-button ${activeTab === 'prompts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('prompts')}
                >
                  Prompts
                </button>
                <button
                  className={`tab-button ${activeTab === 'base' ? 'active' : ''}`}
                  onClick={() => setActiveTab('base')}
                >
                  Base Resume
                </button>
                <button
                  className={`tab-button ${activeTab === 'template' ? 'active' : ''}`}
                  onClick={() => setActiveTab('template')}
                >
                  Resume Template
                </button>
              </div>

              <div className="editor-content">
                {activeTab === 'prompts' && (
                  <div className="prompts-editor">
                    <div className="prompts-list">
                      <div className="prompts-list-header">
                        <h3>Prompts</h3>
                        <button
                          type="button"
                          className="button-secondary button-icon-plus"
                          onClick={handlePromptNew}
                          title="New prompt"
                          aria-label="New prompt"
                        >
                          <span aria-hidden>+</span>
                        </button>
                      </div>
                      {prompts.length === 0 ? (
                        <div className="empty-state">
                          <p>No prompts for this profile yet.</p>
                        </div>
                      ) : (
                        <ul className="prompts-list-items">
                          {prompts.map((p) => (
                            <li
                              key={p.prompt_id}
                              className={`prompt-item ${
                                editingPromptId === p.prompt_id ? 'active' : ''
                              }`}
                            >
                              <div
                                className="prompt-item-main"
                                onClick={() => handlePromptEdit(p)}
                              >
                                <span className="prompt-item-name">{p.name}</span>
                                <span className="prompt-item-updated">
                                  Updated: {new Date(p.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                              <button
                                className="button-link button-small"
                                onClick={() => handlePromptArchive(p.prompt_id)}
                              >
                                Archive
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="prompts-editor-form">
                      <label className="prompts-label">
                        Prompt name
                        <input
                          type="text"
                          value={promptName}
                          onChange={(e) => setPromptName(e.target.value)}
                          className="prompts-name-input"
                          placeholder="e.g. Mobile-focused, Web platform"
                        />
                      </label>
                      <label className="prompts-label">
                        Prompt text
                        <textarea
                          value={promptText}
                          onChange={(e) => setPromptText(e.target.value)}
                          className="editor-textarea"
                          placeholder="Enter the full prompt/instructions for this profile & role..."
                          rows={14}
                        />
                      </label>
                      <div className="prompts-actions">
                        <button className="button-primary" onClick={handlePromptSave}>
                          {editingPromptId ? 'Save Prompt' : 'Create Prompt'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'base' && (
                  <textarea
                    value={baseResumeText}
                    onChange={(e) => {
                      setBaseResumeText(e.target.value);
                      setEditing(true);
                    }}
                    className="editor-textarea"
                    placeholder="Paste your full base resume here (plain text)..."
                    rows={20}
                  />
                )}
                {activeTab === 'template' && (
                  <textarea
                    value={templateHtml}
                    onChange={(e) => {
                      setTemplateHtml(e.target.value);
                      setEditing(true);
                    }}
                    className="editor-textarea"
                    placeholder="Enter HTML template here..."
                    rows={20}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="screen-placeholder">
              <p>Select a profile to edit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilesScreen;
