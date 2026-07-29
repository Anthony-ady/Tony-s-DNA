/** True when running as the Chrome extension (build flag or chrome.runtime). */
export const IS_EXTENSION =
  import.meta.env.VITE_APP_TARGET === "extension" ||
  (typeof chrome !== "undefined" &&
    typeof chrome.runtime?.id === "string" &&
    chrome.runtime.id.length > 0);
