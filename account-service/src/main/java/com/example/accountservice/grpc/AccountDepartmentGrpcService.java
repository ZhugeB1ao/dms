package com.example.accountservice.grpc;

import com.example.accountservice.repository.UserRepository;
import com.example.grpc.account.AccountDepartmentServiceGrpc;
import com.example.grpc.account.DepartmentCheckRequest;
import com.example.grpc.account.DepartmentCheckResponse;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.service.GrpcService;

@GrpcService
@RequiredArgsConstructor
public class AccountDepartmentGrpcService extends AccountDepartmentServiceGrpc.AccountDepartmentServiceImplBase {
    private final UserRepository users;

    @Override
    public void hasActiveUsersInDepartment(DepartmentCheckRequest req, StreamObserver<DepartmentCheckResponse> out) {
        boolean hasActive = users.existsActiveByDepartmentId(req.getDepartmentId());
        out.onNext(DepartmentCheckResponse.newBuilder().setHasActiveUsers(hasActive).build());
        out.onCompleted();
    }
}
