chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractJobDetails") {
    try {
      console.log("[LinkedIn Job Assistant] Starting DOM extraction...");
      let jobTitle = "";
      let company = "";
      let jobDescription = "";

      // Strategy 1: JSON-LD Structured Data (highly robust for standalone details pages)
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      console.log(`[LinkedIn Job Assistant] Found ${scripts.length} JSON-LD script blocks.`);
      
      for (let script of scripts) {
        try {
          const data = JSON.parse(script.innerText);
          const findJobPosting = (obj) => {
            if (!obj) return null;
            if (obj["@type"] === "JobPosting") return obj;
            if (Array.isArray(obj)) {
              for (let item of obj) {
                const res = findJobPosting(item);
                if (res) return res;
              }
            }
            if (obj["@graph"] && Array.isArray(obj["@graph"])) {
              return findJobPosting(obj["@graph"]);
            }
            return null;
          };
          
          const jobPosting = findJobPosting(data);
          if (jobPosting) {
            jobTitle = jobPosting.title || "";
            if (jobPosting.hiringOrganization) {
              company = jobPosting.hiringOrganization.name || "";
            }
            jobDescription = jobPosting.description || "";
            console.log("[LinkedIn Job Assistant] Found job posting in JSON-LD.");
            break;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // Strategy 2: Scoped DOM selectors (essential for dynamic search view panels)
      let pane = document.querySelector(
        ".jobs-search-two-pane__details, .jobs-search__job-details, .jobs-details, .job-view-layout, main.scaffold-layout__main, main, #main"
      );
      
      if (pane) {
        console.log("[LinkedIn Job Assistant] Scoped searches inside active details pane:", pane);
      } else {
        console.log("[LinkedIn Job Assistant] Scoped details pane not found, searching document body.");
        pane = document;
      }

      if (!jobTitle) {
        const titleSelectors = [
          ".job-details-jobs-unified-top-card__job-title",
          ".jobs-unified-top-card__job-title",
          "h1.t-24",
          "h1.t-20",
          "h2.t-24",
          "h2.t-bold",
          ".jobs-details h1",
          ".jobs-details h2",
          "main h1",
          "main h2",
          ".topcard__title"
        ];
        for (let selector of titleSelectors) {
          let el = pane.querySelector(selector);
          if (el && el.innerText.trim()) {
            jobTitle = el.innerText.trim();
            break;
          }
        }
      }

      // Clean/validate scraped jobTitle before proceeding
      if (jobTitle) {
        let t = jobTitle.trim().toLowerCase();
        if (t === "about the job" || t === "about the company" || t === "job description" || t.includes("sign in") || t.includes("on-site") || t.includes("hybrid") || t.includes("remote")) {
          console.log(`[LinkedIn Job Assistant] Rejected section heading/workplace type: "${jobTitle}"`);
          jobTitle = ""; // Reset to force fallbacks
        }
      }

      if (!company) {
        const companySelectors = [
          "a[href*='/company/']", // Link containing company profile URL
          ".job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name a",
          "[class*='company-name']",
          "[class*='company-link']",
          ".topcard__flavor a",
          ".topcard__flavor"
        ];
        for (let selector of companySelectors) {
          let el = pane.querySelector(selector);
          if (el && el.innerText.trim()) {
            company = el.innerText.trim();
            console.log(`[LinkedIn Job Assistant] Extracted company via selector: ${selector}`);
            break;
          }
        }
      }

      // Specific description selectors
      if (!jobDescription) {
        const descSelectors = [
          ".show-more-less-html__markup", // Logged-out / guest page markup
          "#job-details",
          ".jobs-description__container",
          "article.jobs-description__container",
          "article",
          ".jobs-description-content__text",
          ".jobs-box__html-content",
          ".jobs-description__content",
          ".jobs-description",
          "[class*='jobs-description']",
          "[class*='description-content']",
          "[class*='job-description']",
          ".description__text",
          ".job-description"
        ];
        for (let selector of descSelectors) {
          let el = document.querySelector(selector);
          if (el && el.innerText.trim()) {
            jobDescription = el.innerText.trim();
            console.log(`[LinkedIn Job Assistant] Extracted description via selector: ${selector}`);
            break;
          }
        }
      }

      // Heuristic Description Selector using "About the job" text anchor (100% resilient to obfuscation)
      if (!jobDescription) {
        console.log("[LinkedIn Job Assistant] Description selectors failed. Scanning for 'About the job' text anchor...");
        let allElements = document.getElementsByTagName("*");
        for (let el of allElements) {
          let text = el.innerText ? el.innerText.trim() : "";
          if (text === "About the job" || text === "Job description" || text === "Job Description") {
            let parent = el.parentElement;
            if (parent) {
              let parentText = parent.innerText || "";
              let cleanText = parentText.replace(text, "").trim();
              if (cleanText.length > 100) {
                jobDescription = cleanText;
                console.log("[LinkedIn Job Assistant] Extracted description via 'About the job' parent anchor.");
                break;
              }
            }
            let sibling = el.nextElementSibling;
            if (sibling) {
              let siblingText = sibling.innerText || "";
              if (siblingText.trim().length > 100) {
                jobDescription = siblingText.trim();
                console.log("[LinkedIn Job Assistant] Extracted description via 'About the job' sibling anchor.");
                break;
              }
            }
          }
        }
      }

      // Strategy 3: Heuristic Title Heading Scan
      if (!jobTitle) {
        console.log("[LinkedIn Job Assistant] Title selectors failed. Running heuristic heading scan...");
        const headingTags = ["h1", "h2"];
        for (let tag of headingTags) {
          let headings = document.getElementsByTagName(tag);
          for (let h of headings) {
            let text = h.innerText.trim();
            if (text && text.length > 5 && text.length < 100 && !text.includes("LinkedIn") && text !== "On-site" && text !== "Hybrid" && text !== "Remote" && !text.includes("Sign in") && text.toLowerCase() !== "about the job" && text.toLowerCase() !== "about the company") {
              jobTitle = text;
              console.log(`[LinkedIn Job Assistant] Extracted title via heuristic ${tag}: "${jobTitle}"`);
              break;
            }
          }
          if (jobTitle) break;
        }
      }

      // Strategy 4: Tab Title Fallback (Resilient fallback for title & company name)
      if (!jobTitle || !company) {
        let pageTitle = document.title;
        console.log(`[LinkedIn Job Assistant] Running Tab Title split fallback on: "${pageTitle}"`);
        if (pageTitle) {
          if (pageTitle.includes(" hiring ") && pageTitle.includes(" in ")) {
            let parts = pageTitle.split(" hiring ");
            if (!company) company = parts[0].trim();
            if (!jobTitle) {
              let subParts = parts[1].split(" in ");
              jobTitle = subParts[0].trim();
            }
          } else if (pageTitle.includes(" at ") && pageTitle.includes(" | ")) {
            let parts = pageTitle.split(" | ")[0].split(" at ");
            if (!jobTitle) jobTitle = parts[0].trim();
            if (!company) company = parts[1].trim();
          }
        }
      }

      // Cleanup company name
      if (company) {
        if (company.includes("·")) {
          company = company.split("·")[0].trim();
        }
        company = company.split("\n")[0].trim();
        company = company.replace(/\s+/g, ' ').trim();
      }

      if (jobDescription) {
        // Strip HTML tags if description came from JSON-LD
        if (jobDescription.includes("<") && jobDescription.includes(">")) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = jobDescription;
          jobDescription = tempDiv.innerText;
        }
        jobDescription = jobDescription.replace(/\s+/g, ' ').trim();
      }

      console.log("[LinkedIn Job Assistant] Final Scraped Details:", { jobTitle, company, descLength: jobDescription ? jobDescription.length : 0 });

      sendResponse({
        success: true,
        jobTitle: jobTitle,
        company: company,
        jobDescription: jobDescription
      });
    } catch (e) {
      console.error("[LinkedIn Job Assistant] Scraping Error: ", e);
      sendResponse({
        success: false,
        error: e.toString()
      });
    }
  }
  return true; // Keep channel open
});
