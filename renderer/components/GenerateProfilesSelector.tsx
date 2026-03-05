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
        <label className="generate-profiles-label">Profiles</label>
        <div className="generate-profiles-list">
          <ul className="generate-profile-checkboxes">
            {profiles.map((p) => (
              <li key={p.profile_id}>
                <label className="generate-profile-checkbox-label">
                  <input
                    type="radio"
                    name="generate-profile"
                    checked={selectedProfileId === p.profile_id}
                    onChange={() => onSelectProfile(p.profile_id)}
                  />
                  <span>
                    {p.name} {p.is_default ? '(default)' : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
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

