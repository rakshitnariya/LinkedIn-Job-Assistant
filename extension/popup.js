const BACKEND_URL = "http://localhost:8081";

// State variables
let selectedResumeId = "";
let scrapedJobDetails = null;

// DOM Elements
const resumeSelect = document.getElementById("resume-select");
const btnDeleteResume = document.getElementById("btn-delete-resume");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("resume-file");
const uploadStatus = document.getElementById("upload-status");
const btnExtract = document.getElementById("btn-extract");
const jobInfoCard = document.getElementById("job-info-card");
const scrapedDetailsDiv = document.getElementById("scraped-details");
const inputTitle = document.getElementById("input-title");
const inputCompany = document.getElementById("input-company");
const inputDescription = document.getElementById("input-description");
const btnGenerate = document.getElementById("btn-generate");
const toneSelect = document.getElementById("tone-select");
const loaderContainer = document.getElementById("loader-container");
const outputSection = document.getElementById("output-section");
const txtCoverLetter = document.getElementById("txt-cover-letter");
const txtEmail = document.getElementById("txt-email");
const toast = document.getElementById("toast");

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  loadResumes();
  setupUploadListeners();
  setupExtractionListeners();
  setupDeleteListener();
  setupInputListeners();
  setupGenerationListeners();
  setupTabListeners();
  setupCopyListeners();
});

// 1. Load resumes from backend
function loadResumes() {
  chrome.runtime.sendMessage({ action: "fetchResumes" }, (response) => {
    if (response && response.success) {
      // Clear current items (except default option)
      resumeSelect.innerHTML = '<option value="">-- Choose saved resume --</option>';
      
      const resumes = response.data;
      resumes.forEach((resume) => {
        const option = document.createElement("option");
        option.value = resume.id;
        option.textContent = resume.fileName + " (" + new Date(resume.uploadedAt).toLocaleDateString() + ")";
        resumeSelect.appendChild(option);
      });

      // Maintain selection if previously set
      if (selectedResumeId) {
        resumeSelect.value = selectedResumeId;
      }
      checkGenerationReadiness();
    } else {
      console.warn("Could not fetch resumes from backend. Is the server running?");
      showStatusText("⚠️ Server offline. Please start Spring Boot.", true);
      checkGenerationReadiness();
    }
  });
}

// 2. Setup Upload drag & drop
function setupUploadListeners() {
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--secondary-color)";
    dropZone.style.background = "rgba(6, 182, 212, 0.05)";
  });

  ["dragleave", "dragend"].forEach((type) => {
    dropZone.addEventListener(type, () => {
      dropZone.style.borderColor = "var(--border-color)";
      dropZone.style.background = "rgba(15, 23, 42, 0.4)";
    });
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--border-color)";
    dropZone.style.background = "rgba(15, 23, 42, 0.4)";
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });
}

function uploadFile(file) {
  if (file.type !== "application/pdf") {
    showStatusText("❌ Only PDF files are supported.", true);
    return;
  }

  showStatusText("⏳ Parsing & uploading resume...", false);
  const formData = new FormData();
  formData.append("file", file);

  fetch(`${BACKEND_URL}/api/resumes/upload`, {
    method: "POST",
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => { throw new Error(text || "Upload failed"); });
    }
    return response.json();
  })
  .then(data => {
    showStatusText("✅ Uploaded: " + file.name, false);
    selectedResumeId = data.id;
    loadResumes(); // Refresh resume list
    checkGenerationReadiness();
  })
  .catch(err => {
    console.error("Resume upload error", err);
    showStatusText("❌ Parse failed: " + err.message, true);
  });
}

function showStatusText(text, isError) {
  uploadStatus.textContent = text;
  uploadStatus.style.color = isError ? "#f87171" : "var(--text-secondary)";
}

// 3. Setup Extraction Listeners
function setupExtractionListeners() {
  resumeSelect.addEventListener("change", (e) => {
    selectedResumeId = e.target.value;
    checkGenerationReadiness();
  });

  btnExtract.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      if (!activeTab.url.includes("linkedin.com")) {
        setJobCardPlaceholder("⚠️ Not a LinkedIn page. Open a LinkedIn job view tab.");
        return;
      }

      setJobCardPlaceholder("⏳ Scanning page elements...");
      
      chrome.tabs.sendMessage(activeTab.id, { action: "extractJobDetails" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          setJobCardPlaceholder("❌ Content script not loaded. Refresh your LinkedIn page.");
          return;
        }

        // Scraping succeeds if we get at least the title or description
        if (response && response.success && (response.jobTitle || response.jobDescription)) {
          scrapedJobDetails = {
            jobTitle: response.jobTitle || "",
            company: response.company || "",
            jobDescription: response.jobDescription || ""
          };

          // Populate the input fields for manual verification
          inputTitle.value = scrapedJobDetails.jobTitle;
          inputCompany.value = scrapedJobDetails.company;
          inputDescription.value = scrapedJobDetails.jobDescription;
          
          jobInfoCard.classList.remove("empty");
          jobInfoCard.querySelector(".placeholder-text").style.display = "none";
          scrapedDetailsDiv.style.display = "block";
          
          checkGenerationReadiness();
        } else {
          setJobCardPlaceholder("❌ Details not found. Ensure job panel is fully loaded.");
        }
      });
    });
  });
}

// Setup Delete selected resume listener
function setupDeleteListener() {
  btnDeleteResume.addEventListener("click", () => {
    if (!selectedResumeId) return;

    if (confirm("Are you sure you want to delete this resume? This will also remove any generated cover letters or outreach history associated with it.")) {
      btnDeleteResume.disabled = true;
      fetch(`${BACKEND_URL}/api/resumes/${selectedResumeId}`, {
        method: "DELETE"
      })
      .then(response => {
        if (!response.ok) throw new Error("Delete failed");
        showStatusText("🗑️ Selected resume was deleted.", false);
        selectedResumeId = "";
        loadResumes(); // Reload select list options
      })
      .catch(err => {
        console.error("Error deleting resume:", err);
        alert("Failed to delete resume: " + err.message);
        btnDeleteResume.disabled = false;
      });
    }
  });
}

function setupInputListeners() {
  inputTitle.addEventListener("input", checkGenerationReadiness);
  inputCompany.addEventListener("input", checkGenerationReadiness);
  inputDescription.addEventListener("input", checkGenerationReadiness);
}

function setJobCardPlaceholder(text) {
  jobInfoCard.classList.add("empty");
  scrapedDetailsDiv.style.display = "none";
  const placeholder = jobInfoCard.querySelector(".placeholder-text");
  placeholder.style.display = "block";
  placeholder.textContent = text;
  checkGenerationReadiness();
}

function checkGenerationReadiness() {
  const titleVal = inputTitle ? inputTitle.value.trim() : "";
  const companyVal = inputCompany ? inputCompany.value.trim() : "";
  const descVal = inputDescription ? inputDescription.value.trim() : "";

  // Enable/Disable delete button based on whether a resume is selected
  btnDeleteResume.disabled = !selectedResumeId;

  const isReady = selectedResumeId && titleVal && companyVal && descVal;
  btnGenerate.disabled = !isReady;

  const warningEl = document.getElementById("generation-warning");
  if (warningEl) {
    if (isReady) {
      warningEl.style.display = "none";
    } else if (selectedResumeId || titleVal || companyVal || descVal) {
      warningEl.style.display = "block";
      if (!selectedResumeId) {
        warningEl.textContent = "⚠️ Please select or upload a resume in Step 1.";
      } else if (!titleVal) {
        warningEl.textContent = "⚠️ Job Title cannot be empty.";
      } else if (!companyVal) {
        warningEl.textContent = "⚠️ Company Name cannot be empty.";
      } else if (!descVal) {
        warningEl.textContent = "⚠️ Job Description is empty. Scrape again or paste it here.";
      }
    } else {
      warningEl.style.display = "none";
    }
  }
}

// 4. Setup Generation Listeners
function setupGenerationListeners() {
  btnGenerate.addEventListener("click", () => {
    const titleVal = inputTitle.value.trim();
    const companyVal = inputCompany.value.trim();
    const descVal = inputDescription.value.trim();

    if (!selectedResumeId || !titleVal || !companyVal || !descVal) return;

    loaderContainer.style.display = "flex";
    outputSection.style.display = "none";
    btnGenerate.disabled = true;

    const payload = {
      resumeId: selectedResumeId,
      jobTitle: titleVal,
      company: companyVal,
      jobDescription: descVal,
      tone: toneSelect.value
    };

    chrome.runtime.sendMessage({ action: "generateOutreach", payload }, (response) => {
      loaderContainer.style.display = "none";
      btnGenerate.disabled = false;

      if (response && response.success) {
        txtCoverLetter.value = response.data.coverLetter;
        txtEmail.value = response.data.emailBody;
        outputSection.style.display = "block";
        
        // Scroll to results
        setTimeout(() => {
          outputSection.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        alert("Generation failed: " + (response ? response.error : "Unknown backend error"));
      }
    });
  });
}

// 5. Setup Tab Listeners
function setupTabListeners() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active from all tabs
      tabButtons.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));

      // Add active to current
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");
    });
  });
}

// 6. Setup Copy Buttons
function setupCopyListeners() {
  const copyButtons = document.querySelectorAll(".btn-copy");
  copyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const textarea = document.getElementById(targetId);
      
      textarea.select();
      document.execCommand("copy");
      
      // Deselect text
      window.getSelection().removeAllRanges();
      
      showToast();
    });
  });
}

function showToast() {
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}
