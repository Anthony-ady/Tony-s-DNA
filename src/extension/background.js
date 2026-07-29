/** Opens the full ADY app in a browser tab when the extension icon is clicked. */
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
