// Fetch in the extension worker: page content scripts are subject to page CORS.
const API_BASE_URL = 'http://127.0.0.1:5002';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'fetchAndAnalyze' || !sender.tab) return;
  (async () => {
    try {
      const url = new URL(request.imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Use an HTTP or HTTPS image, or upload the file in the web app.');
      }
      const imageResponse = await fetch(url.href, { signal: AbortSignal.timeout(30000) });
      if (!imageResponse.ok) throw new Error(`Image download failed (${imageResponse.status}).`);
      const imageBlob = await imageResponse.blob();
      if (imageBlob.size > 8 * 1024 * 1024) throw new Error('Image exceeds the 8 MB upload limit.');
      const formData = new FormData();
      formData.append('file', imageBlob, 'image.jpg');
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST', body: formData, signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `API error (${response.status}).`);
      sendResponse({ ok: true, result });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  })();
  return true;
});

// Background service worker - creates right-click context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "verifyImage",
    title: "Verify with RealReveal",
    contexts: ["image"]
  });
  console.log("✅ RealReveal context menu installed");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "verifyImage" && info.srcUrl) {
    // Send message to content script to analyze the image
    chrome.tabs.sendMessage(tab.id, {
      action: "analyzeImage",
      imageUrl: info.srcUrl
    }, (response) => {
      // Handle errors gracefully (e.g., content script not loaded yet)
      if (chrome.runtime.lastError) {
        console.log('Content script not ready:', chrome.runtime.lastError.message);
        // Optionally show a notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'RealReveal',
          message: 'Please reload the page and try again.'
        });
      }
    });
  }
});
