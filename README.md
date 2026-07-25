# LinkedIn Job Assistant & Outreach Generator

An intelligent, production-ready system that automates resume matching and job application outreach. This project consists of a **Chrome Extension (Manifest V3)** for front-end scraping/interaction and a **Spring Boot (Java 17+)** backend powered by **Spring AI** and **PostgreSQL** for resume parsing, document storage, and customized document generation.

---

## 🚀 Key Features

* **Chrome Extension (Manifest V3)**: Scrapes LinkedIn job details (Job Title, Company, Description) directly from active tabs with advanced DOM-parsing and fallback heuristics.
* **Resume Parser Service**: Extracts candidate profile details (Name, Contact Info, Skills, Work History, Education) from uploaded PDF resumes.
* **Outreach Writer**: Automatically drafts high-quality, targeted **Cover Letters** and **Cold Emails** matching the candidate's background to the job requirements.
* **Google Gemini & Local Mock Engines**: Leverages Spring AI to query Google Gemini (via OpenAI compatibility endpoints) with a fail-safe, 50ms local offline mock engine.
* **Production-Grade Database**: Uses PostgreSQL (relational structure + native JSONB support) for persistent storage and foreign key cascading.

---

## 🛠️ Tech Stack

* **Backend**: Spring Boot 3.3.x, Spring AI, Hibernate/JPA, Lombok, Apache PDFBox.
* **Database**: PostgreSQL (relational structure + native JSONB support).
* **Frontend**: Chrome Extension (Vanilla HTML5, CSS3, JavaScript Manifest V3) with a modern Glassmorphism dark UI.

---

## 📂 Project Structure

```text
linkedin-job-assistant/
│
├── backend/                   # Spring Boot Backend Service
│   ├── src/main/java/         # REST Controllers, Services, Repositories, Entities
│   ├── src/main/resources/    # application.yml Configuration
│   └── pom.xml                # Maven Dependencies
│
├── extension/                 # Chrome Browser Extension (Manifest V3)
│   ├── manifest.json          # Extension Settings & Permissions
│   ├── popup.html             # Glassmorphic Popup UI
│   ├── popup.css              # Popup styling rules
│   ├── popup.js               # Event handlers & backend bindings
│   ├── content.js             # LinkedIn DOM scraping scripts
│   └── background.js          # Cross-origin API network worker
│
└── .gitignore                 # Excludes build/target & system files
```

---

## ⚙️ Setup & Installation

### 1. Database Setup
Ensure you have a local PostgreSQL instance running:
* **Database**: `job_assistant`
* **Username**: `postgres`
* **Password**: `root`
* **Port**: `5432`

### 2. Configure Backend (`backend/src/main/resources/application.yml`)
Add your Google Gemini API key or toggle local offline mode:
```yaml
ai:
  openai:
    base-url: https://generativelanguage.googleapis.com/v1beta/openai/
    api-key: AIzaSy... # Your Gemini Key

# Toggle true to bypass API keys and run locally at instantaneous speed (50ms)
app:
  offline-mode: true
```

### 3. Run Spring Boot Backend
Navigate to the `backend/` folder in your terminal and execute:
```bash
mvn clean spring-boot:run
```
The server will start on port `8081` (`http://localhost:8081`).

### 4. Load the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** (top left).
4. Select your **`extension/`** folder from this project directory.

---

## 📋 How to Use

1. Open the extension popup, **Upload your Resume PDF**, and select it from the dropdown list.
2. Go to any LinkedIn Job Posting page.
3. Click **Extract from Page** (or manually paste/edit the job details in the fields).
4. Click **Generate Outreach Documents** to view your custom-tailored Cover Letter and Cold Email drafts!
