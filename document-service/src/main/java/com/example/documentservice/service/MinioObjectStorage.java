package com.example.documentservice.service;

import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.Http;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.errors.MinioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MinioObjectStorage implements ObjectStorage {
    private final MinioClient minioClient;
    private final MinioClient minioPresignClient;
    private final Set<String> ensuredBuckets = ConcurrentHashMap.newKeySet();

    public MinioObjectStorage(
            @Qualifier("minioClient") MinioClient minioClient,
            @Qualifier("minioPresignClient") MinioClient minioPresignClient) {
        this.minioClient = minioClient;
        this.minioPresignClient = minioPresignClient;
    }

    @Override
    public void put(String bucket, String key, InputStream in, long size, String contentType) {
        ensureBucket(bucket);
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(key)
                    .stream(in, size, -1L)
                    .contentType(contentType)
                    .build());
        } catch (MinioException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Object storage unavailable", e);
        }
    }

    @Override
    public void delete(String bucket, String key) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(key)
                    .build());
        } catch (MinioException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Object storage unavailable", e);
        }
    }

    @Override
    public String presignGet(String bucket, String key, String fileName, String mimeType, boolean inline, int expirySeconds) {
        Map<String, String> params = Map.of(
                "response-content-type", mimeType,
                "response-content-disposition", buildContentDisposition(fileName, inline));
        try {
            return minioPresignClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Http.Method.GET)
                    .bucket(bucket)
                    .object(key)
                    .expiry(expirySeconds)
                    .extraQueryParams(params)
                    .build());
        } catch (MinioException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Object storage unavailable", e);
        }
    }

    private void ensureBucket(String bucket) {
        if (ensuredBuckets.contains(bucket)) {
            return;
        }
        synchronized (ensuredBuckets) {
            if (ensuredBuckets.contains(bucket)) {
                return;
            }
            try {
                if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                }
                ensuredBuckets.add(bucket);
            } catch (MinioException e) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Object storage unavailable", e);
            }
        }
    }

    static String buildContentDisposition(String fileName, boolean inline) {
        String clean = stripControlChars(fileName);
        String asciiFallback = toAsciiFallback(clean);
        String rfc5987Encoded = URLEncoder.encode(clean, StandardCharsets.UTF_8)
                .replace("+", "%20")
                .replace("*", "%2A");
        String type = inline ? "inline" : "attachment";
        return type + "; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + rfc5987Encoded;
    }

    private static String stripControlChars(String value) {
        if (value == null) {
            return "file";
        }
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (!Character.isISOControl(c)) {
                sb.append(c);
            }
        }
        String cleaned = sb.toString().trim();
        return cleaned.isEmpty() ? "file" : cleaned;
    }

    private static String toAsciiFallback(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        StringBuilder sb = new StringBuilder(normalized.length());
        for (int i = 0; i < normalized.length(); i++) {
            char c = normalized.charAt(i);
            if (c >= 0x20 && c <= 0x7E && c != '"' && c != '\\' && c != ';') {
                sb.append(c);
            } else {
                sb.append('_');
            }
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? "file" : result;
    }
}
