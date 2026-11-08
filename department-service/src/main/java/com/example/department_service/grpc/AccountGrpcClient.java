package com.example.department_service.grpc;

import com.example.department_service.exception.ServiceUnavailableException;
import com.example.grpc.account.AccountDepartmentServiceGrpc;
import com.example.grpc.account.DepartmentCheckRequest;
import com.example.grpc.account.DepartmentCheckResponse;
import io.grpc.Channel;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class AccountGrpcClient {

    private final boolean enabled;
    private final long deadlineMs;
    private final Set<Long> mockBusyDepartmentIds;
    private final Channel channel;
    private final ManagedChannel managedChannel;

    @org.springframework.beans.factory.annotation.Autowired
    public AccountGrpcClient(
            @Value("${app.account-grpc.enabled:false}") boolean enabled,
            @Value("${app.account-grpc.host:localhost}") String host,
            @Value("${app.account-grpc.port:9092}") int port,
            @Value("${app.account-grpc.deadline-ms:2000}") long deadlineMs,
            @Value("${app.account-grpc.mock-busy-department-ids:}") String mockBusyIdsStr
    ) {
        this.enabled = enabled;
        this.deadlineMs = deadlineMs;
        this.mockBusyDepartmentIds = parseIds(mockBusyIdsStr);
        if (enabled) {
            this.managedChannel = ManagedChannelBuilder.forAddress(host, port)
                    .usePlaintext()
                    .build();
            this.channel = this.managedChannel;
        } else {
            this.managedChannel = null;
            this.channel = null;
        }
    }

    public AccountGrpcClient(Channel channel, long deadlineMs) {
        this.enabled = true;
        this.deadlineMs = deadlineMs;
        this.mockBusyDepartmentIds = Collections.emptySet();
        this.channel = channel;
        this.managedChannel = null;
    }

    public boolean hasActiveUsers(Long departmentId) {
        if (!enabled) {
            return mockBusyDepartmentIds.contains(departmentId);
        }
        try {
            AccountDepartmentServiceGrpc.AccountDepartmentServiceBlockingStub stub =
                    AccountDepartmentServiceGrpc.newBlockingStub(channel)
                            .withDeadlineAfter(deadlineMs, TimeUnit.MILLISECONDS);

            DepartmentCheckRequest request = DepartmentCheckRequest.newBuilder()
                    .setDepartmentId(departmentId)
                    .build();

            DepartmentCheckResponse response = stub.hasActiveUsersInDepartment(request);
            return response.getHasActiveUsers();
        } catch (StatusRuntimeException e) {
            throw new ServiceUnavailableException("Không thể kiểm tra trạng thái tài khoản từ account-service, vui lòng thử lại sau.");
        } catch (Exception e) {
            throw new ServiceUnavailableException("Không thể kiểm tra trạng thái tài khoản từ account-service, vui lòng thử lại sau.");
        }
    }

    @PreDestroy
    public void shutdown() {
        if (managedChannel != null && !managedChannel.isShutdown()) {
            managedChannel.shutdown();
            try {
                if (!managedChannel.awaitTermination(2, TimeUnit.SECONDS)) {
                    managedChannel.shutdownNow();
                }
            } catch (InterruptedException e) {
                managedChannel.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }

    private static Set<Long> parseIds(String str) {
        if (str == null || str.isBlank()) {
            return Collections.emptySet();
        }
        return Arrays.stream(str.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toSet());
    }
}
