import { useState, useEffect } from 'react';
import type { Profile } from '@shared/types';

function ProfilesScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'template'>('rules');
  const [profileName, setProfileName] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
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
      setRulesText(selectedProfile.rules_text);
      setTemplateHtml(selectedProfile.template_html);
      setEditing(false);
      setValidationResult(null);
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
        template_html: selectedProfile.template_html,
        is_default: false,
      });

      if (response.success && response.profile) {
        await loadProfiles();
        setSelectedProfile(response.profile);
      } else {
        alert(response.error || 'Failed to create profile');
      }
    } catch (err) {
      alert('Failed to create profile');
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!selectedProfile) return;

    setSaving(true);
    try {
      const response = await window.electronAPI.profilesUpdate(selectedProfile.profile_id, {
        name: profileName,
        rules_text: rulesText,
        template_html: templateHtml,
      });

      if (response.success && response.profile) {
        await loadProfiles();
        setSelectedProfile(response.profile);
        setEditing(false);
        setValidationResult(null);
        alert('Profile saved successfully');
      } else {
        alert(response.error || 'Failed to save profile');
      }
    } catch (err) {
      alert('Failed to save profile');
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
        alert('Default profile updated');
      } else {
        alert(response.error || 'Failed to set default profile');
      }
    } catch (err) {
      alert('Failed to set default profile');
      console.error(err);
    }
  };

  const handleArchive = async () => {
    if (!selectedProfile) return;
    if (!confirm(`Are you sure you want to archive "${selectedProfile.name}"?`)) return;

    try {
      const response = await window.electronAPI.profilesArchive(selectedProfile.profile_id);
      if (response.success) {
        await loadProfiles();
        setSelectedProfile(null);
        alert('Profile archived');
      } else {
        alert(response.error || 'Failed to archive profile');
      }
    } catch (err) {
      alert('Failed to archive profile');
      console.error(err);
    }
  };

  const handleValidate = async () => {
    try {
      const response = await window.electronAPI.profilesValidate({
        rules_text: rulesText,
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
      } else {
        alert(response.error || 'Validation failed');
      }
    } catch (err) {
      alert('Failed to validate profile');
      console.error(err);
    }
  };

  const handleCancel = () => {
    if (selectedProfile) {
      setProfileName(selectedProfile.name);
      setRulesText(selectedProfile.rules_text);
      setTemplateHtml(selectedProfile.template_html);
    }
    setEditing(false);
    setValidationResult(null);
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
                  className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
                  onClick={() => setActiveTab('rules')}
                >
                  Rules
                </button>
                <button
                  className={`tab-button ${activeTab === 'template' ? 'active' : ''}`}
                  onClick={() => setActiveTab('template')}
                >
                  Resume Template
                </button>
              </div>

              <div className="editor-content">
                {activeTab === 'rules' ? (
                  <textarea
                    value={rulesText}
                    onChange={(e) => {
                      setRulesText(e.target.value);
                      setEditing(true);
                    }}
                    className="editor-textarea"
                    placeholder="Enter rules text here..."
                    rows={20}
                  />
                ) : (
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

              <div className="editor-footer">
                <div className="editor-info">
                  <span>Rules Hash: {selectedProfile.rules_hash.substring(0, 8)}...</span>
                  <span>Template Hash: {selectedProfile.template_hash.substring(0, 8)}...</span>
                </div>
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
