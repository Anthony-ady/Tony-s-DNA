export function createPageUrl(pageName: string) {
  return '/' + pageName.replace(/ /g, '-');
}

/** Opens an in-app route in a new browser tab (HashRouter-safe in the Chrome extension). */
export function openAppRouteInNewTab(routePath: string) {
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  if (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime?.getURL === 'function' &&
    chrome.runtime.id
  ) {
    window.open(`${chrome.runtime.getURL('index.html')}#${path}`, '_blank', 'noopener,noreferrer');
    return;
  }
  window.open(path, '_blank', 'noopener,noreferrer');
}

export * from './formatters';