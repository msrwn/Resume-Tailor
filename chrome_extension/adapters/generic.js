/**
 * Generic ATS adapter: find fields by label, aria-label, placeholder, nearby text;
 * fill text, checkbox, radio, select. Full name = firstName + " " + lastName.
 * Does NOT fill submit buttons or consent/legal checkboxes.
 */
(function () {
  function normalizeLabel(s) {
    if (typeof s !== 'string') return '';
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function getFieldLabel(el) {
    const id = el.id;
    if (id) {
      const label = document.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]');
      if (label) return normalizeLabel(label.textContent);
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return normalizeLabel(ariaLabel);
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return normalizeLabel(placeholder);
    const parent = el.closest('label');
    if (parent) return normalizeLabel(parent.textContent);
    const prev = el.previousElementSibling;
    if (prev && prev.matches('label')) return normalizeLabel(prev.textContent);
    return '';
  }

  /**
   * Map common label fragments to our data keys or applicant fields.
   * Returns { key, getValue(data) } or null.
   */
  function matchLabelToKey(label, data) {
    if (!label) return null;
    const l = label;
    const applicantKeys = {
      'first name': function (d) {
        return d.applicant && d.applicant.firstName;
      },
      'last name': function (d) {
        return d.applicant && d.applicant.lastName;
      },
      'full name': function (d) {
        if (!d.applicant) return null;
        return [d.applicant.firstName, d.applicant.lastName].filter(Boolean).join(' ').trim() || null;
      },
      email: function (d) {
        return d.applicant && d.applicant.email;
      },
      phone: function (d) {
        return d.applicant && d.applicant.phone;
      },
      address: function (d) {
        return d.applicant && d.applicant.address && d.applicant.address.address1;
      },
      'address 1': function (d) {
        return d.applicant && d.applicant.address && d.applicant.address.address1;
      },
      city: function (d) {
        return d.applicant && d.applicant.address && d.applicant.address.city;
      },
      state: function (d) {
        return d.applicant && d.applicant.address && d.applicant.address.state;
      },
      zip: function (d) {
        return d.applicant && d.applicant.address && d.applicant.address.zip;
      },
      country: function (d) {
        return d.applicant && d.applicant.address && d.applicant.address.country;
      },
    };
    for (const key in applicantKeys) {
      if (l.indexOf(key) !== -1) return { key: key, getValue: applicantKeys[key] };
    }
    const answers = (data && data.answers) || {};
    for (const k in answers) {
      const frag = k.replace(/[._]/g, ' ').toLowerCase();
      if (l.indexOf(frag) !== -1 || frag.indexOf(l) !== -1) {
        const key = k;
        return { key: key, getValue: function (d) { return d.answers && d.answers[key]; } };
      }
    }
    return null;
  }

  function fillInput(input, value) {
    if (input.readOnly) return { ok: false, error: 'read-only' };
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }

  function fillCheckbox(input, value) {
    const on = /^(1|true|yes|on)$/i.test(String(value).trim());
    input.checked = on;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }

  function fillSelect(select, value) {
    const v = String(value).trim().toLowerCase();
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      const text = (opt.textContent || '').trim().toLowerCase();
      const val = (opt.value || '').trim().toLowerCase();
      if (val === v || text === v || text.indexOf(v) !== -1) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
      }
    }
    return { ok: false, error: 'option not found' };
  }

  function fillRadio(group, value) {
    const v = String(value).trim().toLowerCase();
    for (let i = 0; i < group.length; i++) {
      const radio = group[i];
      const label = getFieldLabel(radio) || (radio.nextSibling && radio.nextSibling.textContent) || '';
      const val = (radio.value || '').trim().toLowerCase();
      if (val === v || normalizeLabel(label).indexOf(v) !== -1) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
      }
    }
    return { ok: false, error: 'option not found' };
  }

  function isSubmitButton(el) {
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.type || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const text = (el.textContent || '').toLowerCase();
    if (tag === 'button' && type === 'submit') return true;
    if (tag === 'input' && type === 'submit') return true;
    if (role === 'button' && (text.indexOf('submit') !== -1 || text.indexOf('apply') !== -1)) return true;
    if (text.indexOf('submit application') !== -1 || text.indexOf('apply now') !== -1) return true;
    return false;
  }

  function isConsentCheckbox(el, label) {
    if ((el.type || '').toLowerCase() !== 'checkbox') return false;
    const l = (label || '').toLowerCase();
    if (l.indexOf('agree') !== -1 || l.indexOf('consent') !== -1 || l.indexOf('terms') !== -1) return true;
    if (l.indexOf('certify') !== -1 || l.indexOf('penalty of perjury') !== -1) return true;
    return false;
  }

  function fill(data) {
    const filled = [];
    const missing = [];
    const errors = [];
    const d = data || {};
    d.answers = d.answers || {};
    const processedRadioNames = {};
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
    inputs.forEach(function (el) {
      if (isSubmitButton(el)) return;
      const label = getFieldLabel(el);
      if (isConsentCheckbox(el, label)) return;
      const mapped = matchLabelToKey(label, d);
      if (!mapped) return;
      const value = mapped.getValue(d);
      if (value === null || value === undefined || value === '') return;
      const strVal = String(value).trim();
      const tag = (el.tagName || '').toLowerCase();
      const type = (el.type || '').toLowerCase();
      let result;
      if (tag === 'select') {
        result = fillSelect(el, strVal);
      } else if (type === 'checkbox') {
        result = fillCheckbox(el, strVal);
      } else if (type === 'radio') {
        const name = el.name;
        if (name && !processedRadioNames[name]) {
          processedRadioNames[name] = true;
          const group = document.querySelectorAll('input[name="' + name.replace(/"/g, '\\"') + '"][type="radio"]');
          result = fillRadio(group, strVal);
        } else {
          result = { ok: true };
        }
      } else {
        result = fillInput(el, strVal);
      }
      if (result.ok) {
        filled.push(mapped.key);
      } else {
        if (result.error) errors.push(mapped.key + ': ' + result.error);
        else missing.push(mapped.key);
      }
    });
    return { filled: filled, missing: missing, errors: errors };
  }

  if (!window.ResumeTailorAdapters) window.ResumeTailorAdapters = {};
  window.ResumeTailorAdapters.generic = fill;
})();
