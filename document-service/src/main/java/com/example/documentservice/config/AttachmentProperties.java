package com.example.documentservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app.attachments")
public class AttachmentProperties {
    private long maxSizeBytes = 10_485_760L;
    private int presignExpirySeconds = 300;
}
