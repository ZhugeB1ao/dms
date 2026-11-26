package com.example.documentservice;

import com.example.documentservice.config.AttachmentProperties;
import com.example.documentservice.service.FileValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileValidatorTest {
    private FileValidator validator;

    @BeforeEach
    void setUp() {
        var props = new AttachmentProperties();
        props.setMaxSizeBytes(10_485_760L);
        validator = new FileValidator(props);
    }

    @Test
    void acceptsAllAllowedTypesWithMatchingMagicBytes() {
        assertValid("doc.pdf", "application/pdf", "%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII), "application/pdf", ".pdf");
        assertValid("scan.PNG", "image/png", new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1}, "image/png", ".png");
        assertValid("photo.jpg", "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, "image/jpeg", ".jpg");
        assertValid("photo.jpeg", "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE1}, "image/jpeg", ".jpeg");
        assertValid("image.webp", "image/webp", "RIFF1234WEBP".getBytes(StandardCharsets.US_ASCII), "image/webp", ".webp");
        assertValid("vanban.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                new byte[]{0x50, 0x4B, 0x03, 0x04, 0x14, 0x00},
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx");
        assertValid("bangke.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[]{0x50, 0x4B, 0x03, 0x04, 0x14, 0x00},
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx");
    }

    @Test
    void allowsGenericOctetStreamOnlyWhenExtensionAndMagicMatch() {
        var file = new MockMultipartFile("file", "scan.pdf", "application/octet-stream",
                "%PDF-1.4 content".getBytes(StandardCharsets.US_ASCII));
        var validated = validator.validate(file);
        assertThat(validated.mimeType()).isEqualTo("application/pdf");

        var spoofed = new MockMultipartFile("file", "scan.pdf", "application/octet-stream",
                "MZ\u0090\u0000".getBytes(StandardCharsets.US_ASCII));
        assertStatus(spoofed, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    @Test
    void rejectsEmptyOrMissingFileWith400() {
        assertThatThrownBy(() -> validator.validate(null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));

        var empty = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);
        assertStatus(empty, HttpStatus.BAD_REQUEST);
    }

    @Test
    void rejectsOversizeFileWith413() {
        byte[] big = new byte[10_485_761];
        System.arraycopy("%PDF-".getBytes(StandardCharsets.US_ASCII), 0, big, 0, 5);
        var file = new MockMultipartFile("file", "huge.pdf", "application/pdf", big);
        assertStatus(file, HttpStatus.CONTENT_TOO_LARGE);
    }

    @Test
    void rejectsDisallowedExtensionsWith415() {
        assertStatus(new MockMultipartFile("file", "run.exe", "application/octet-stream", new byte[]{0x4D, 0x5A, 0x00}),
                HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertStatus(new MockMultipartFile("file", "icon.svg", "image/svg+xml", "<svg></svg>".getBytes(StandardCharsets.UTF_8)),
                HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertStatus(new MockMultipartFile("file", "page.html", "text/html", "<html></html>".getBytes(StandardCharsets.UTF_8)),
                HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    @Test
    void rejectsSpoofedMagicOrMismatchedDeclaredMimeWith415() {
        assertStatus(new MockMultipartFile("file", "fake.pdf", "application/pdf",
                new byte[]{0x4D, 0x5A, 0x50, 0x00, 0x02}), HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertStatus(new MockMultipartFile("file", "xss.pdf", "application/pdf",
                "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)), HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertStatus(new MockMultipartFile("file", "valid.pdf", "text/html",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII)), HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertStatus(new MockMultipartFile("file", "valid.png", "image/svg+xml",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}), HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    @Test
    void stripsTraversalPathsAndRejectsNoExtensionOrOverlongNames() {
        var traversalWithExt = new MockMultipartFile("file", "../../etc/passwd.pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        assertThat(validator.validate(traversalWithExt).fileName()).isEqualTo("passwd.pdf");

        var windowsPath = new MockMultipartFile("file", "C:\\fakepath\\vanban.pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        assertThat(validator.validate(windowsPath).fileName()).isEqualTo("vanban.pdf");

        var traversalNoExt = new MockMultipartFile("file", "../../etc/passwd", "application/octet-stream",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        assertStatus(traversalNoExt, HttpStatus.UNSUPPORTED_MEDIA_TYPE);

        var tooLong = new MockMultipartFile("file", "a".repeat(252) + ".pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        assertStatus(tooLong, HttpStatus.BAD_REQUEST);
    }

    @Test
    void preservesUnicodeVietnameseFileNamesAndStripsControlChars() {
        var vietnamese = new MockMultipartFile("file", "Công văn\r\n số 123 - UBND.pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        var validated = validator.validate(vietnamese);
        assertThat(validated.fileName()).isEqualTo("Công văn số 123 - UBND.pdf");
    }

    @Test
    void isPreviewableMatchesOnlyPdfAndSupportedImages() {
        assertThat(validator.isPreviewable("application/pdf")).isTrue();
        assertThat(validator.isPreviewable("image/png")).isTrue();
        assertThat(validator.isPreviewable("image/jpeg")).isTrue();
        assertThat(validator.isPreviewable("image/webp")).isTrue();
        assertThat(validator.isPreviewable("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).isFalse();
        assertThat(validator.isPreviewable("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).isFalse();
        assertThat(validator.isPreviewable(null)).isFalse();
    }

    private void assertValid(String name, String contentType, byte[] bytes, String expectedMime, String expectedExt) {
        var file = new MockMultipartFile("file", name, contentType, bytes);
        var validated = validator.validate(file);
        assertThat(validated.mimeType()).isEqualTo(expectedMime);
        assertThat(validated.extension()).isEqualTo(expectedExt);
        assertThat(validated.size()).isEqualTo(bytes.length);
    }

    private void assertStatus(MockMultipartFile file, HttpStatus expected) {
        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(expected));
    }
}
