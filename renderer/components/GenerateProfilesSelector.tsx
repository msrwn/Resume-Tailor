import type { Profile } from '@shared/types';

type Props = {
  profiles: Profile[];
  selectedProfileIds: string[];
  onToggleProfile: (profileId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  outputPathSet: boolean;
  apiKeySet: boolean;
};

export function GenerateProfilesSelector({
  profiles,
  selectedProfileIds,
  onToggleProfile,
  onSelectAll,
  onDeselectAll,
  outputPathSet,
  apiKeySet,
}: Props) {
  return (
    <div className="generate-form generate-form-root">
      <label>Profiles</label>
      <div className="generate-profiles-list">
        <div className="generate-profiles-actions">
          <button
            type="button"
            className="button-secondary button-small"
            onClick={onSelectAll}
          >
            Select all
          </button>
          <button
            type="button"
            className="button-secondary button-small"
            onClick={onDeselectAll}
          >
            Deselect all
          </button>
        </div>
        <ul className="generate-profile-checkboxes">
          {profiles.map((p) => (
            <li key={p.profile_id}>
              <label className="generate-profile-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedProfileIds.includes(p.profile_id)}
                  onChange={() => onToggleProfile(p.profile_id)}
                />
                <span>
                  {p.name} {p.is_default ? '(default)' : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {selectedProfileIds.length > 0 && (
          <p className="generate-profiles-hint">
            {selectedProfileIds.length} profile
            {selectedProfileIds.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>
      {(!outputPathSet || !apiKeySet) && (
        <div className="message message-warning">
          {!outputPathSet && 'Set the output folder in Settings. '}
          {!apiKeySet && 'Add your API key in Settings.'}
        </div>
      )}
    </div>
  );
}

