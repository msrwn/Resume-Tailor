import type { Profile } from '@shared/types';

type Props = {
  profiles: Profile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  outputPathSet: boolean;
  apiKeySet: boolean;
};

export function GenerateProfilesSelector({
  profiles,
  selectedProfileId,
  onSelectProfile,
  outputPathSet,
  apiKeySet,
}: Props) {
  return (
    <div className="generate-form generate-form-root">
      <div className="generate-profiles-row">
        <label className="generate-profiles-label" htmlFor="generate-profile-select">
          Profile
        </label>
        <div className="generate-profiles-list">
          <select
            id="generate-profile-select"
            className="history-profile-filter"
            value={selectedProfileId ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                onSelectProfile(value);
              }
            }}
          >
            <option value="" disabled>
              Select a profile…
            </option>
            {profiles.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.name} {p.is_default ? '(default)' : ''}
              </option>
            ))}
          </select>
        </div>
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

