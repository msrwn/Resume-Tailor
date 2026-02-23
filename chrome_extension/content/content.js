/**
 * Content script: show overlay on ATS pages, call /match and /autofill,
 * display paths + Copy, and "Fill this page" using the generic adapter.
 */
(function () {
  const OVERLAY_ID = 'resume-tailor-overlay-root';

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return document.getElementById(OVERLAY_ID);
    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.innerHTML =
      '<div class="rt-header">Resume Tailor</div>' +
      '<div class="rt-body">' +
      '  <div id="rt-message" class="rt-message"></div>' +
      '  <div id="rt-paths" style="display: none;">' +
      '    <div class="rt-row"><span class="rt-label">Resume:</span><span class="rt-path" id="rt-resume-path">—</span><button type="button" class="rt-copy" id="rt-copy-resume" disabled>Copy</button></div>' +
      '    <div class="rt-row"><span class="rt-label">Cover:</span><span class="rt-path" id="rt-cover-path">—</span><button type="button" class="rt-copy" id="rt-copy-cover" disabled>Copy</button></div>' +
      '  </div>' +
      '  <button type="button" class="rt-fill-btn" id="rt-fill-btn" style="display: none;">Fill this page</button>' +
      '  <div id="rt-result" class="rt-result" style="display: none;"></div>' +
      '</div>';
    document.body.appendChild(root);
    return root;
  }

  function setMessage(el, text, isError) {
    el.textContent = text;
    el.className = 'rt-message' + (isError ? ' error' : '');
    el.style.display = text ? 'block' : 'none';
  }

  function setPath(row, path, copyBtn) {
    const pathEl = row;
    const display = path && path.trim() ? path : '—';
    pathEl.textContent = display;
    pathEl.title = path || '';
    copyBtn.disabled = !path || !path.trim();
    copyBtn.dataset.path = path || '';
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

  async function run() {
    const stored = await window.ResumeTailorStorage.getStoredProfile();
    if (!stored.profileId) {
      const root = createOverlay();
      setMessage(root.querySelector('#rt-message'), 'Select a profile in the extension popup first.', true);
      return;
    }

    let baseUrl;
    try {
      const r = await send('getBaseUrl');
      baseUrl = r && r.baseUrl;
    } catch (_) {
      baseUrl = null;
    }
    if (!baseUrl) {
      const root = createOverlay();
      setMessage(root.querySelector('#rt-message'), 'Resume Tailor is not running. Start the app (ports 38421 or 38422) and try again.', true);
      return;
    }

    let matchResult;
    try {
      const r = await send('match', { baseUrl: baseUrl, url: window.location.href, profileId: stored.profileId });
      if (r && r.error) throw new Error(r.error);
      matchResult = r && r.data;
    } catch (e) {
      const root = createOverlay();
      setMessage(root.querySelector('#rt-message'), e.message || 'Could not reach Resume Tailor. Is the app running?', true);
      return;
    }

    if (!matchResult || matchResult.match !== 'exact') {
      const root = createOverlay();
      setMessage(
        root.querySelector('#rt-message'),
        'No tailored resume found for this job and profile. Generate one in Resume Tailor first.',
        true
      );
      return;
    }

    let autofillData;
    try {
      const r = await send('autofill', { baseUrl: baseUrl, profileId: stored.profileId });
      if (r && r.error) throw new Error(r.error);
      autofillData = r && r.data;
    } catch (e) {
      const root = createOverlay();
      setMessage(root.querySelector('#rt-message'), e.message || 'Failed to load autofill data.', true);
      return;
    }

    const root = createOverlay();
    const messageEl = root.querySelector('#rt-message');
    const pathsEl = root.querySelector('#rt-paths');
    const fillBtn = root.querySelector('#rt-fill-btn');
    const resultEl = root.querySelector('#rt-result');
    const resumePathEl = root.querySelector('#rt-resume-path');
    const coverPathEl = root.querySelector('#rt-cover-path');
    const copyResumeBtn = root.querySelector('#rt-copy-resume');
    const copyCoverBtn = root.querySelector('#rt-copy-cover');

    setMessage(messageEl, '');
    pathsEl.style.display = 'block';
    const files = matchResult.files || {};
    setPath(resumePathEl, files.resumePdfPath || null, copyResumeBtn);
    setPath(coverPathEl, files.coverPdfPath || null, copyCoverBtn);
    fillBtn.style.display = 'block';
    resultEl.style.display = 'none';

    copyResumeBtn.addEventListener('click', function () {
      const p = copyResumeBtn.dataset.path;
      if (p) {
        navigator.clipboard.writeText(p).then(function () {
          copyResumeBtn.textContent = 'Copied!';
          setTimeout(function () {
            copyResumeBtn.textContent = 'Copy';
          }, 1500);
        });
      }
    });
    copyCoverBtn.addEventListener('click', function () {
      const p = copyCoverBtn.dataset.path;
      if (p) {
        navigator.clipboard.writeText(p).then(function () {
          copyCoverBtn.textContent = 'Copied!';
          setTimeout(function () {
            copyCoverBtn.textContent = 'Copy';
          }, 1500);
        });
      }
    });

    fillBtn.addEventListener('click', function () {
      resultEl.innerHTML = '';
      resultEl.style.display = 'block';
      const fn = window.ResumeTailorAdapterRegistry && window.ResumeTailorAdapterRegistry.getFillFn();
      if (!fn) {
        resultEl.textContent = 'No fill adapter available.';
        resultEl.className = 'rt-result';
        return;
      }
      const result = fn(autofillData);
      const parts = [];
      if (result.filled && result.filled.length > 0) {
        parts.push('Filled ' + result.filled.length + ' field(s).');
      }
      if (result.missing && result.missing.length > 0) {
        parts.push('Missing: ' + result.missing.join(', '));
      }
      resultEl.textContent = parts.length ? parts.join(' ') : 'Done.';
      resultEl.className = 'rt-result' + (result.errors && result.errors.length > 0 ? '' : ' filled');
      if (result.errors && result.errors.length > 0) {
        const errDiv = document.createElement('div');
        errDiv.className = 'rt-errors';
        errDiv.textContent = result.errors.join('; ');
        resultEl.appendChild(errDiv);
      }
    });

    fillBtn.disabled = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
