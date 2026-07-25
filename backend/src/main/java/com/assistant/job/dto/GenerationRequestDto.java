package com.assistant.job.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerationRequestDto {
    private UUID resumeId;
    private String jobTitle;
    private String company;
    private String jobDescription;
    private String tone; // e.g. "Professional", "Enthusiastic", "Confident"
}
