package com.assistant.job.controller;

import com.assistant.job.dto.GenerationRequestDto;
import com.assistant.job.dto.GenerationResponseDto;
import com.assistant.job.model.GeneratedDocument;
import com.assistant.job.repository.GeneratedDocumentRepository;
import com.assistant.job.service.GeneratorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/outreach")
@RequiredArgsConstructor
public class OutreachController {

    private final GeneratorService generatorService;
    private final GeneratedDocumentRepository generatedDocumentRepository;

    @PostMapping("/generate")
    public ResponseEntity<?> generateOutreach(@RequestBody GenerationRequestDto request) {
        if (request.getResumeId() == null) {
            return ResponseEntity.badRequest().body("Resume ID is required.");
        }
        if (request.getJobTitle() == null || request.getJobTitle().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Job title is required.");
        }
        if (request.getCompany() == null || request.getCompany().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Company is required.");
        }
        if (request.getJobDescription() == null || request.getJobDescription().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Job description is required.");
        }

        try {
            GenerationResponseDto response = generatorService.generateOutreach(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Outreach generation failed", e);
            return ResponseEntity.internalServerError().body("Failed to generate outreach: " + e.getMessage());
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<GenerationResponseDto>> getHistory() {
        List<GenerationResponseDto> history = generatedDocumentRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(history);
    }

    private GenerationResponseDto mapToDto(GeneratedDocument doc) {
        return GenerationResponseDto.builder()
                .id(doc.getId())
                .jobTitle(doc.getJobTitle())
                .company(doc.getCompany())
                .tone(doc.getTone())
                .coverLetter(doc.getCoverLetter())
                .emailBody(doc.getEmailBody())
                .createdAt(doc.getCreatedAt())
                .build();
    }
}
