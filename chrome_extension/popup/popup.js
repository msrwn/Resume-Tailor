(function () {
  const statusEl = document.getElementById('status');
  const profileSection = document.getElementById('profileSection');
  const profileSelect = document.getElementById('profile');
  const saveBtn = document.getElementById('save');
  const savedEl = document.getElementById('saved');

  function setStatus(className, text) {
    statusEl.className = 'status ' + className;
    statusEl.textContent = text;
  }

  function send(type, payload) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: type, ...payload }, function (response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async function load() {
    setStatus('loading', 'Checking server…');
    let response;
    try {
      response = await send('getBaseUrl');
    } catch (e) {
      setStatus('error', 'Extension error: ' + (e.message || 'Could not reach background.'));
      profileSection.style.display = 'none';
      return;
    }
    const baseUrl = response && response.baseUrl;
    if (!baseUrl) {
      setStatus(
        'error',
        response && response.error
          ? response.error
          : 'Resume Tailor is not running. Start the app (ports 38421 or 38422) and try again.'
      );
      profileSection.style.display = 'none';
      return;
    }
    setStatus('ok', 'Connected to Resume Tailor.');
    profileSection.style.display = 'block';

    try {
      const profResponse = await send('profiles', { baseUrl: baseUrl });
      if (profResponse && profResponse.error) {
        setStatus('error', profResponse.error);
        return;
      }
      const list = profResponse && profResponse.list;
      profileSelect.innerHTML = '<option value="">-- Select profile --</option>';
      if (!list || list.length === 0) {
        setStatus('error', 'No profiles in Resume Tailor. Create one in the app first.');
        return;
      }
      list.forEach(function (p) {
        const opt = document.createElement('option');
        opt.value = p.profileId;
        opt.textContent = p.name || p.profileId;
        profileSelect.appendChild(opt);
      });

      const stored = await window.ResumeTailorStorage.getStoredProfile();
      if (stored.profileId) {
        profileSelect.value = stored.profileId;
      }
    } catch (e) {
      setStatus('error', e.message || 'Failed to load profiles.');
    }
  }

  saveBtn.addEventListener('click', async function () {
    const profileId = profileSelect.value;
    const profileName = profileSelect.options[profileSelect.selectedIndex]?.textContent || '';
    await window.ResumeTailorStorage.setStoredProfile(profileId, profileName);
    savedEl.style.display = 'block';
    setTimeout(function () {
      savedEl.style.display = 'none';
    }, 2000);
  });

  load();
})();
