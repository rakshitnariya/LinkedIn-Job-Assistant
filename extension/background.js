const BACKEND_URL = "http://localhost:8081";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchResumes") {
    fetch(`${BACKEND_URL}/api/resumes`)
      .then(response => {
        if (!response.ok) throw new Error("Server returned status " + response.status);
        return response.json();
      })
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        console.error("fetchResumes failed", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open
  }

  if (request.action === "generateOutreach") {
    fetch(`${BACKEND_URL}/api/outreach/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.payload)
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => { throw new Error(text || "Generation failed"); });
        }
        return response.json();
      })
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        console.error("generateOutreach failed", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open
  }
});
