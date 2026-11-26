package com.example.documentservice.service;

import java.io.InputStream;

public interface ObjectStorage {
    void put(String bucket, String key, InputStream in, long size, String contentType);

    void delete(String bucket, String key);

    String presignGet(String bucket, String key, String fileName, String mimeType, boolean inline, int expirySeconds);
}
