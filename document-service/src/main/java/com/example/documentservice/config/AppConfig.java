package com.example.documentservice.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
@EnableConfigurationProperties(AttachmentProperties.class)
@OpenAPIDefinition(
        info = @Info(title = "Document Service API", version = "1.0",
                description = "Quản lý văn bản (đến, đi, nội bộ). Gọi qua api-gateway với Bearer token."),
        servers = @Server(url = "http://localhost:9090", description = "api-gateway"),
        security = @SecurityRequirement(name = "bearerAuth"))
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class AppConfig implements WebMvcConfigurer {
    static {
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(Caller.class); // không hiện trong OpenAPI
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CallerResolver());
    }
}
