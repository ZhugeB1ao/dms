package com.example.department_service.grpc;

import com.example.department_service.exception.ServiceUnavailableException;
import com.example.grpc.account.AccountDepartmentServiceGrpc;
import com.example.grpc.account.DepartmentCheckRequest;
import com.example.grpc.account.DepartmentCheckResponse;
import io.grpc.ManagedChannel;
import io.grpc.Server;
import io.grpc.Status;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AccountGrpcClientTest {

    private Server server;
    private ManagedChannel channel;

    @AfterEach
    void tearDown() {
        if (channel != null && !channel.isShutdown()) {
            channel.shutdownNow();
        }
        if (server != null && !server.isShutdown()) {
            server.shutdownNow();
        }
    }

    @Test
    @DisplayName("gRPC returns has_active_users = true -> client returns true")
    void hasActiveUsers_ReturnsTrue() throws Exception {
        String serverName = InProcessServerBuilder.generateName();

        server = InProcessServerBuilder.forName(serverName).directExecutor()
                .addService(new AccountDepartmentServiceGrpc.AccountDepartmentServiceImplBase() {
                    @Override
                    public void hasActiveUsersInDepartment(
                            DepartmentCheckRequest request,
                            StreamObserver<DepartmentCheckResponse> responseObserver
                    ) {
                        assertEquals(10L, request.getDepartmentId());
                        responseObserver.onNext(DepartmentCheckResponse.newBuilder().setHasActiveUsers(true).build());
                        responseObserver.onCompleted();
                    }
                })
                .build()
                .start();

        channel = InProcessChannelBuilder.forName(serverName).directExecutor().build();
        AccountGrpcClient client = new AccountGrpcClient(channel, 2000);

        boolean result = client.hasActiveUsers(10L);
        assertTrue(result);
    }

    @Test
    @DisplayName("gRPC returns has_active_users = false -> client returns false")
    void hasActiveUsers_ReturnsFalse() throws Exception {
        String serverName = InProcessServerBuilder.generateName();

        server = InProcessServerBuilder.forName(serverName).directExecutor()
                .addService(new AccountDepartmentServiceGrpc.AccountDepartmentServiceImplBase() {
                    @Override
                    public void hasActiveUsersInDepartment(
                            DepartmentCheckRequest request,
                            StreamObserver<DepartmentCheckResponse> responseObserver
                    ) {
                        assertEquals(20L, request.getDepartmentId());
                        responseObserver.onNext(DepartmentCheckResponse.newBuilder().setHasActiveUsers(false).build());
                        responseObserver.onCompleted();
                    }
                })
                .build()
                .start();

        channel = InProcessChannelBuilder.forName(serverName).directExecutor().build();
        AccountGrpcClient client = new AccountGrpcClient(channel, 2000);

        boolean result = client.hasActiveUsers(20L);
        assertFalse(result);
    }

    @Test
    @DisplayName("Review Focus #4: gRPC server exceeds deadline -> throws ServiceUnavailableException (Fail-Closed)")
    void hasActiveUsers_DeadlineExceeded_ThrowsServiceUnavailable() throws Exception {
        String serverName = InProcessServerBuilder.generateName();

        server = InProcessServerBuilder.forName(serverName).directExecutor()
                .addService(new AccountDepartmentServiceGrpc.AccountDepartmentServiceImplBase() {
                    @Override
                    public void hasActiveUsersInDepartment(
                            DepartmentCheckRequest request,
                            StreamObserver<DepartmentCheckResponse> responseObserver
                    ) {
                        try {
                            Thread.sleep(300);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        }
                        responseObserver.onNext(DepartmentCheckResponse.newBuilder().setHasActiveUsers(false).build());
                        responseObserver.onCompleted();
                    }
                })
                .build()
                .start();

        channel = InProcessChannelBuilder.forName(serverName).directExecutor().build();
        AccountGrpcClient client = new AccountGrpcClient(channel, 100); // 100ms deadline vs 300ms sleep

        ServiceUnavailableException ex = assertThrows(
                ServiceUnavailableException.class,
                () -> client.hasActiveUsers(5L)
        );
        assertTrue(ex.getMessage().contains("Không thể kiểm tra trạng thái tài khoản"));
    }

    @Test
    @DisplayName("Review Focus #4: gRPC server returns UNAVAILABLE status -> throws ServiceUnavailableException (Fail-Closed)")
    void hasActiveUsers_ServerUnavailable_ThrowsServiceUnavailable() throws Exception {
        String serverName = InProcessServerBuilder.generateName();

        server = InProcessServerBuilder.forName(serverName).directExecutor()
                .addService(new AccountDepartmentServiceGrpc.AccountDepartmentServiceImplBase() {
                    @Override
                    public void hasActiveUsersInDepartment(
                            DepartmentCheckRequest request,
                            StreamObserver<DepartmentCheckResponse> responseObserver
                    ) {
                        responseObserver.onError(Status.UNAVAILABLE.withDescription("Service offline").asRuntimeException());
                    }
                })
                .build()
                .start();

        channel = InProcessChannelBuilder.forName(serverName).directExecutor().build();
        AccountGrpcClient client = new AccountGrpcClient(channel, 2000);

        ServiceUnavailableException ex = assertThrows(
                ServiceUnavailableException.class,
                () -> client.hasActiveUsers(5L)
        );
        assertTrue(ex.getMessage().contains("Không thể kiểm tra trạng thái tài khoản"));
    }

    @Test
    @DisplayName("Mock fallback when disabled -> uses mock-busy-department-ids")
    void hasActiveUsers_MockDisabled() {
        AccountGrpcClient client = new AccountGrpcClient(false, "localhost", 9092, 2000, "1,2,99");

        assertTrue(client.hasActiveUsers(1L));
        assertTrue(client.hasActiveUsers(2L));
        assertTrue(client.hasActiveUsers(99L));
        assertFalse(client.hasActiveUsers(3L));
        assertFalse(client.hasActiveUsers(4L));
    }
}
