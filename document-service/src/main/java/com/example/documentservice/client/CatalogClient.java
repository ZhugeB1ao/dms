package com.example.documentservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

/**
 * Hỏi category-service một danh mục có đang hoạt động không, qua GET /api/categories/active?type=... (chỉ trả danh mục is_active).
 * shortcut: mỗi lần kiểm tra là một request không cache, thêm cache ngắn hạn khi category-service thành điểm nghẽn.
 */
@Component
public class CatalogClient {
    public enum Type { DOC_TYPE, URGENCY, CONFIDENTIALITY }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Item(Long id) {}

    private final RestClient http;

    public CatalogClient(@Value("${catalog.base-url}") String baseUrl, @Value("${catalog.token}") String token) {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.http = RestClient.builder().baseUrl(baseUrl).requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + token).build();
    }

    /** @throws ResponseStatusException 503 nếu category-service không trả lời, để không nhầm với "danh mục không hợp lệ" */
    public boolean isActive(Type type, long id) {
        try {
            List<Item> active = http.get().uri("/api/categories/active?type={type}", type)
                    .retrieve().body(new ParameterizedTypeReference<>() {});
            return active != null && active.stream().anyMatch(i -> i.id() != null && i.id() == id);
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Category service unavailable");
        }
    }
}
