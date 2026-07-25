package com.assistant.job.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerationResponseDto {
    private UUID id;
    private String jobTitle;
    private String company;
    private String tone;
    private String coverLetter;
    private String emailBody;
    private LocalDateTime createdAt;
}
