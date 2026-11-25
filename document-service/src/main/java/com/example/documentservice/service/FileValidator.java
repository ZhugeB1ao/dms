package com.example.documentservice.service;

import com.example.documentservice.config.AttachmentProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BiPredicate;

@Component
public class FileValidator {
    private static final int HEADER_BUFFER_SIZE = 12;

    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG_MAGIC = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] ZIP_MAGIC = new byte[]{0x50, 0x4B, 0x03, 0x04};
    private static final byte[] RIFF_MAGIC = "RIFF".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] WEBP_MAGIC = "WEBP".getBytes(StandardCharsets.US_ASCII);

    private record FileSpec(String mimeType, BiPredicate<byte[], Integer> magicMatcher) {}

    private static final Map<String, FileSpec> ALLOWED_EXTENSIONS = Map.of(
            ".pdf", new FileSpec("application/pdf", (buf, len) -> matchesAt(buf, len, 0, PDF_MAGIC)),
            ".png", new FileSpec("image/png", (buf, len) -> matchesAt(buf, len, 0, PNG_MAGIC)),
            ".jpg", new FileSpec("image/jpeg", (buf, len) -> matchesAt(buf, len, 0, JPEG_MAGIC)),
            ".jpeg", new FileSpec("image/jpeg", (buf, len) -> matchesAt(buf, len, 0, JPEG_MAGIC)),
            ".webp", new FileSpec("image/webp", FileValidator::isWebp),
            ".docx", new FileSpec("application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    (buf, len) -> matchesAt(buf, len, 0, ZIP_MAGIC)),
            ".xlsx", new FileSpec("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    (buf, len) -> matchesAt(buf, len, 0, ZIP_MAGIC))
    );

    private static final Set<String> PREVIEWABLE_MIME_TYPES = Set.of(
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp"
    );

    public record ValidatedFile(String fileName, String extension, String mimeType, long size) {}

    private final AttachmentProperties properties;

    public FileValidator(AttachmentProperties properties) {
        this.properties = properties;
    }

    public ValidatedFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File must not be empty");
        }
        if (file.getSize() > properties.getMaxSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE,
                    "File size exceeds limit of " + properties.getMaxSizeBytes() + " bytes");
        }
        String fileName = sanitizeFileName(file.getOriginalFilename());
        String extension = extractExtension(fileName);
        FileSpec spec = ALLOWED_EXTENSIONS.get(extension);
        if (spec == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported file extension");
        }
        validateDeclaredContentType(file.getContentType(), spec.mimeType());
        validateMagicBytes(file, spec.magicMatcher());
        return new ValidatedFile(fileName, extension, spec.mimeType(), file.getSize());
    }

    public boolean isPreviewable(String mimeType) {
        return mimeType != null && PREVIEWABLE_MIME_TYPES.contains(mimeType.toLowerCase(Locale.ROOT));
    }

    private static String sanitizeFileName(String raw) {
        if (raw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File name is required");
        }
        int lastSlash = Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\'));
        String base = lastSlash >= 0 ? raw.substring(lastSlash + 1) : raw;
        StringBuilder sb = new StringBuilder(base.length());
        for (int i = 0; i < base.length(); i++) {
            char c = base.charAt(i);
            if (!Character.isISOControl(c)) {
                sb.append(c);
            }
        }
        String sanitized = sb.toString().trim();
        if (sanitized.isBlank() || ".".equals(sanitized) || "..".equals(sanitized) || sanitized.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name");
        }
        return sanitized;
    }

    private static String extractExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot <= 0 || dot == fileName.length() - 1) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported file type");
        }
        return fileName.substring(dot).toLowerCase(Locale.ROOT);
    }

    private static void validateDeclaredContentType(String declared, String canonicalMime) {
        if (declared == null || declared.isBlank()) {
            return;
        }
        int semi = declared.indexOf(';');
        String normalized = (semi >= 0 ? declared.substring(0, semi) : declared).trim().toLowerCase(Locale.ROOT);
        if (!normalized.isEmpty()
                && !normalized.equals(canonicalMime)
                && !"application/octet-stream".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Content-Type does not match file type");
        }
    }

    private static void validateMagicBytes(MultipartFile file, BiPredicate<byte[], Integer> matcher) {
        byte[] header = new byte[HEADER_BUFFER_SIZE];
        int totalRead = 0;
        try (InputStream in = file.getInputStream()) {
            while (totalRead < HEADER_BUFFER_SIZE) {
                int n = in.read(header, totalRead, HEADER_BUFFER_SIZE - totalRead);
                if (n == -1) {
                    break;
                }
                totalRead += n;
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read uploaded file", e);
        }
        if (!matcher.test(header, totalRead)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "File content does not match declared file type");
        }
    }

    private static boolean isWebp(byte[] buf, int len) {
        return len >= 12 && matchesAt(buf, len, 0, RIFF_MAGIC) && matchesAt(buf, len, 8, WEBP_MAGIC);
    }

    private static boolean matchesAt(byte[] buf, int len, int offset, byte[] magic) {
        if (len < offset + magic.length) {
            return false;
        }
        for (int i = 0; i < magic.length; i++) {
            if (buf[offset + i] != magic[i]) {
                return false;
            }
        }
        return true;
    }
}
