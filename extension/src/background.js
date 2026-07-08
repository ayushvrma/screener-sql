// On first install, open the welcome tab so the user can paste a Gemini key.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/welcome.html") });
  }
});

// Content script can ask the worker to open the options/setup page on demand.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "openSetup") {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else chrome.tabs.create({ url: chrome.runtime.getURL("src/welcome.html") });
    sendResponse({ ok: true });
  }
});
