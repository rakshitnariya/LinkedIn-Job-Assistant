package com.assistant.job.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class SpringAIConfig {

    @Autowired(required = false)
    private OpenAiChatModel openAiChatModel;

    @Autowired(required = false)
    private OllamaChatModel ollamaChatModel;

    @Bean
    @Primary
    public ChatModel primaryChatModel() {
        if (openAiChatModel != null) {
            return openAiChatModel;
        }
        if (ollamaChatModel != null) {
            return ollamaChatModel;
        }
        throw new IllegalStateException("No ChatModel bean available. Configure OpenAI API key or start local Ollama.");
    }
}
