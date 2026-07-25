package com.assistant.job.service;

import com.assistant.job.dto.GenerationRequestDto;
import com.assistant.job.dto.GenerationResponseDto;
import com.assistant.job.model.GeneratedDocument;
import com.assistant.job.model.Resume;
import com.assistant.job.repository.GeneratedDocumentRepository;
import com.assistant.job.repository.ResumeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeneratorService {

    private final ResumeRepository resumeRepository;
    private final GeneratedDocumentRepository generatedDocumentRepository;
    private final ChatModel chatModel;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.offline-mode:false}")
    private boolean offlineMode;

    public GenerationResponseDto generateOutreach(GenerationRequestDto request) {
        Resume resume = resumeRepository.findById(request.getResumeId())
                .orElseThrow(() -> new IllegalArgumentException("Resume not found with ID: " + request.getResumeId()));

        String tone = request.getTone() != null ? request.getTone() : "Professional";
        
        // AI call to generate both cover letter and email body in structured JSON format
        String generatedJson = generateWithAI(resume.getStructuredData(), request.getJobTitle(), request.getCompany(), request.getJobDescription(), tone);

        String coverLetter = "";
        String emailBody = "";

        try {
            JsonNode rootNode = objectMapper.readTree(generatedJson);
            coverLetter = rootNode.path("coverLetter").asText();
            emailBody = rootNode.path("emailBody").asText();
        } catch (Exception e) {
            log.error("Failed to parse generated JSON outreach from AI", e);
            // Fallback: If parsing fails, treat the whole response as the cover letter and create a simple email body
            coverLetter = generatedJson;
            emailBody = "Hi Hiring Team,\n\nI am interested in the " + request.getJobTitle() + " role at " + request.getCompany() + ". Please find my application attached.\n\nBest regards,\nCandidate";
        }

        GeneratedDocument doc = GeneratedDocument.builder()
                .resume(resume)
                .jobTitle(request.getJobTitle())
                .company(request.getCompany())
                .tone(tone)
                .coverLetter(coverLetter)
                .emailBody(emailBody)
                .build();

        GeneratedDocument saved = generatedDocumentRepository.save(doc);

        return GenerationResponseDto.builder()
                .id(saved.getId())
                .jobTitle(saved.getJobTitle())
                .company(saved.getCompany())
                .tone(saved.getTone())
                .coverLetter(saved.getCoverLetter())
                .emailBody(saved.getEmailBody())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    private String generateWithAI(String resumeStructuredJson, String jobTitle, String company, String jobDescription, String tone) {
        if (offlineMode) {
            log.info("Offline mode active. Using local outreach generator.");
            return generateMockOutreach(resumeStructuredJson, jobTitle, company, tone);
        }
        String promptText = """
                You are an expert career advisor and professional writer. Create a highly tailored Cover Letter and a cold outreach Email body for a candidate applying to a job.
                
                Align the candidate's skills, qualifications, and past experiences with the requirements mentioned in the job description. Highlight achievements that demonstrate fit.
                
                The tone of the writing must be: {tone}
                
                Inputs:
                - Candidate Profile (JSON):
                {resumeJson}
                
                - Target Job: {jobTitle} at {company}
                - Job Description:
                {jobDescription}
                
                Response Format:
                Format the response strictly as a single JSON object. Do not include markdown code block formatting (like ```json), just return the raw JSON.
                The JSON must conform to the following schema:
                {
                  "coverLetter": "The complete text of the cover letter. Use professional spacing and formatting with newlines (\\n). Include address placeholders at the top.",
                  "emailBody": "The complete text of the cold outreach email. Include a catchy Subject line at the beginning."
                }
                """;

        String finalPrompt = promptText
                .replace("{tone}", tone)
                .replace("{resumeJson}", resumeStructuredJson != null ? resumeStructuredJson : "{}")
                .replace("{jobTitle}", jobTitle)
                .replace("{company}", company)
                .replace("{jobDescription}", jobDescription);
        Prompt prompt = new Prompt(finalPrompt);

        try {
            String responseContent = chatModel.call(prompt).getResult().getOutput().getContent();
            return cleanJsonString(responseContent);
        } catch (Exception e) {
            log.warn("Spring AI call failed during outreach generation. Falling back to local mock generator.", e);
            return generateMockOutreach(resumeStructuredJson, jobTitle, company, tone);
        }
    }

    private String generateMockOutreach(String resumeJson, String jobTitle, String company, String tone) {
        String name = "Candidate";
        try {
            if (resumeJson != null && !resumeJson.isEmpty()) {
                JsonNode rootNode = objectMapper.readTree(resumeJson);
                name = rootNode.path("fullName").asText("Candidate");
            }
        } catch (Exception e) {
            log.warn("Failed to extract candidate name for mock cover letter", e);
        }
        
        String coverLetter = "Dear Hiring Team at " + company + ",\n\n" +
                "I am writing to express my strong interest in the " + jobTitle + " position at your organization. " +
                "With my experience in software development, I am highly confident in my ability to hit the ground running.\n\n" +
                "I have experience designing, building, and deploying scalable software systems. The opportunity to work at " + 
                company + " aligns perfectly with my professional goals and my dedication to engineering excellence. " +
                "I am excited to bring my skills to your team in this " + tone.toLowerCase() + " capacity.\n\n" +
                "Thank you for your consideration. I look forward to the possibility of discussing how my background fits your team's needs.\n\n" +
                "Sincerely,\\n" + name;

        String emailBody = "Subject: Application for " + jobTitle + " at " + company + "\n\n" +
                "Hi Hiring Team,\n\n" +
                "My name is " + name + ", and I am reaching out to express interest in the " + jobTitle + " role at " + company + ".\n\n" +
                "I have strong experience developing back-end APIs and working with database structures. " +
                "I would love to schedule a quick call to talk about how my skills could add value to " + company + ".\n\n" +
                "Best regards,\\n" + name;

        return "{\n" +
                "  \"coverLetter\": \"" + coverLetter.replace("\n", "\\n").replace("\"", "\\\"") + "\",\n" +
                "  \"emailBody\": \"" + emailBody.replace("\n", "\\n").replace("\"", "\\\"") + "\"\n" +
                "}";
    }

    private String cleanJsonString(String response) {
        if (response == null) return "{}";
        String cleaned = response.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }
        return cleaned.trim();
    }
}
