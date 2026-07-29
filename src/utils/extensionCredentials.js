const STORAGE_KEY = 'ayl_remember_credentials';

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function readFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @returns {Promise<{ email: string, password: string } | null>} */
export async function loadSavedCredentials() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved = result[STORAGE_KEY];
    if (!saved?.email) return null;
    return saved;
  }
  return readFromLocalStorage();
}

/** @param {string} email @param {string} password */
export async function saveCredentials(email, password) {
  const data = { email: email.trim(), password };
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearSavedCredentials() {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
