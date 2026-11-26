package com.example.documentservice;

import com.example.documentservice.service.MinioObjectStorage;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MinioObjectStorageTest {

    @Test
    void usesInternalClientForPutAndDeleteAndPresignClientForPresignGet() throws Exception {
        MinioClient internal = mock(MinioClient.class);
        MinioClient presign = mock(MinioClient.class);
        when(internal.bucketExists(any(BucketExistsArgs.class))).thenReturn(false);
        when(presign.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("http://localhost:9000/attachments/k?X-Amz-Signature=abc");

        var storage = new MinioObjectStorage(internal, presign);
        storage.put("attachments", "documents/1/g/v1/f.pdf", new ByteArrayInputStream(new byte[]{1, 2, 3}), 3L, "application/pdf");
        storage.put("attachments", "documents/1/g/v2/f.pdf", new ByteArrayInputStream(new byte[]{4, 5}), 2L, "application/pdf");

        verify(internal, times(1)).bucketExists(any(BucketExistsArgs.class));
        verify(internal, times(1)).makeBucket(any(MakeBucketArgs.class));
        verify(internal, times(2)).putObject(any(PutObjectArgs.class));
        verifyNoInteractions(presign);

        String url = storage.presignGet("attachments", "documents/1/g/v2/f.pdf",
                "Công văn \"mật\"\r\n.pdf", "application/pdf", true, 300);
        assertThat(url).contains("X-Amz-Signature=abc");

        ArgumentCaptor<GetPresignedObjectUrlArgs> captor = ArgumentCaptor.forClass(GetPresignedObjectUrlArgs.class);
        verify(presign).getPresignedObjectUrl(captor.capture());
        String disposition = captor.getValue().extraQueryParams().getFirst("response-content-disposition");
        assertThat(captor.getValue().extraQueryParams().getFirst("response-content-type")).isEqualTo("application/pdf");
        assertThat(disposition).startsWith("inline; filename=\"Cong van _mat_.pdf\"; filename*=UTF-8''");
        assertThat(disposition).doesNotContain("\r", "\n");
        assertThat(disposition).contains("C%C3%B4ng%20v%C4%83n%20%22m%E1%BA%ADt%22.pdf");

        storage.delete("attachments", "documents/1/g/v1/f.pdf");
        verify(internal).removeObject(any(RemoveObjectArgs.class));
    }
}
