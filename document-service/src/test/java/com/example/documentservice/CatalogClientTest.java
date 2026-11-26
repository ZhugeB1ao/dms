package com.example.documentservice;

import com.example.documentservice.client.CatalogClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Chạy CatalogClient thật với một HTTP server giả đóng vai category-service. */
class CatalogClientTest {
    private HttpServer server;
    private volatile int status;
    private volatile String lastAuth;
    private volatile String lastQuery;
    private CatalogClient client;

    @BeforeEach
    void start() throws Exception {
        status = 200;
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/api/categories/active", ex -> {
            lastAuth = ex.getRequestHeaders().getFirst("Authorization");
            lastQuery = ex.getRequestURI().getQuery();
            // Dạng thật của CategoryResponse (có thêm trường mà client không dùng)
            byte[] body = """
                    [{"id":1,"type":"URGENCY","code":"KHAN","name":"Khẩn","symbol":"K","isActive":true},
                     {"id":3,"type":"URGENCY","code":"HOA_TOC","name":"Hỏa tốc","symbol":"HT","isActive":true}]
                    """.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
        client = new CatalogClient("http://localhost:" + server.getAddress().getPort(), "tok");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void isActive_trueOnlyForIdsInTheActiveList_andSendsTypeAndToken() {
        assertThat(client.isActive(CatalogClient.Type.URGENCY, 3)).isTrue();
        assertThat(client.isActive(CatalogClient.Type.URGENCY, 2)).isFalse();
        assertThat(lastQuery).isEqualTo("type=URGENCY");
        assertThat(lastAuth).isEqualTo("Bearer tok");
    }

    @Test
    void serverError_or_unreachable_is503_notAnInvalidCategory() {
        status = 500;
        assertThatThrownBy(() -> client.isActive(CatalogClient.Type.DOC_TYPE, 1))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));

        var unreachable = new CatalogClient("http://localhost:1", "tok");
        assertThatThrownBy(() -> unreachable.isActive(CatalogClient.Type.DOC_TYPE, 1))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }
}
