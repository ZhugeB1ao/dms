package com.example.authservice.service;

import com.example.accountservice.grpc.AccountInfo;
import com.example.accountservice.grpc.Credentials;
import com.example.authservice.client.AccountClient;
import com.example.authservice.dto.AuthResponse;
import com.example.authservice.dto.LoginRequest;
import com.example.authservice.dto.RefreshTokenRequest;
import com.example.authservice.entity.RefreshToken;
import com.example.authservice.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** AuthService chỉ lo xác thực và cấp token; dữ liệu tài khoản lấy từ account-service qua AccountClient (mock). */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    private static final String SHA256_OF_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock AccountClient accounts;
    @Mock JwtService jwtService;
    @Mock PasswordEncoder passwordEncoder;

    AuthService authService;
    AccountInfo user;

    @BeforeEach
    void setUp() {
        authService = new AuthService(refreshTokenRepository, accounts, jwtService, passwordEncoder);
        ReflectionTestUtils.setField(authService, "refreshTokenExpiration", 60_000L);
        user = account(true, 0);
    }

    private static AccountInfo account(boolean active, int tokenVersion) {
        return AccountInfo.newBuilder().setId(1).setUsername("u").setRole("EMPLOYEE").setDepartmentId(1)
                .setTokenVersion(tokenVersion).setActive(active).setMustChangePassword(false).build();
    }

    private static Credentials credentials(AccountInfo account) {
        return Credentials.newBuilder().setAccount(account).setPasswordHash("hash").build();
    }

    private static HttpStatus statusOf(ResponseStatusException e) {
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    private RefreshToken storedToken(Instant expiresAt) {
        return RefreshToken.builder().id(10L).userId(1L).tokenHash(SHA256_OF_ABC).tokenVersion(0)
                .expiresAt(expiresAt).build();
    }

    @Test
    void loginSucceedsAndStoresOnlyTheRefreshTokenHash() {
        when(accounts.credentials("u")).thenReturn(Optional.of(credentials(user)));
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);
        when(jwtService.generateAccessToken(user)).thenReturn("access");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AuthResponse res = authService.login(new LoginRequest("u", "pw"));

        assertEquals("access", res.accessToken());
        assertEquals("Bearer", res.tokenType());
        verify(refreshTokenRepository).save(argThat(t ->
                !t.getTokenHash().equals(res.refreshToken()) && t.getUserId() == 1L && t.getTokenVersion() == 0));
    }

    @Test
    void loginRejectsWrongPasswordUnknownUserAndInactiveAccount() {
        when(accounts.credentials("u")).thenReturn(Optional.of(credentials(user)));
        when(accounts.credentials("ghost")).thenReturn(Optional.empty());
        when(accounts.credentials("off")).thenReturn(Optional.of(credentials(account(false, 0))));
        when(passwordEncoder.matches("bad", "hash")).thenReturn(false);
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);

        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("u", "bad")))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("ghost", "pw")))));
        assertEquals(HttpStatus.FORBIDDEN, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("off", "pw")))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest(null, "pw")))));
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refreshRotatesTokenAndMarksOldOneRevokedAndReplaced() {
        RefreshToken old = storedToken(Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(old));
        when(accounts.find(1L)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("access2");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> {
            RefreshToken t = inv.getArgument(0);
            if (t.getId() == null) t.setId(11L);
            return t;
        });

        AuthResponse res = authService.refreshToken(new RefreshTokenRequest("abc"));

        assertEquals("access2", res.accessToken());
        assertNotEquals("abc", res.refreshToken());
        assertTrue(old.isRevoked());
        assertEquals(11L, old.getReplacedBy());
    }

    @Test
    void refreshWithAlreadyUsedTokenRevokesAllSessions() {
        RefreshToken old = storedToken(Instant.now().plusSeconds(60));
        old.setRevokedAt(Instant.now());
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(old));

        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));
        verify(accounts).bumpTokenVersion(1L);
    }

    @Test
    void refreshRejectsBlankUnknownAndExpiredTokens() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest(" ")))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("nope")))));

        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC))
                .thenReturn(Optional.of(storedToken(Instant.now().minusSeconds(1))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));
    }

    @Test
    void refreshRejectsInactiveAccountAndChangedTokenVersion() {
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC))
                .thenAnswer(inv -> Optional.of(storedToken(Instant.now().plusSeconds(60))));

        when(accounts.find(1L)).thenReturn(Optional.of(account(false, 0)));
        assertEquals(HttpStatus.FORBIDDEN, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));

        // account-service đã tăng token_version (khóa/mở lại tài khoản, đặt lại mật khẩu)
        when(accounts.find(1L)).thenReturn(Optional.of(account(true, 1)));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));

        when(accounts.find(1L)).thenReturn(Optional.empty());
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));
    }

    @Test
    void logoutRevokesRefreshTokenAndBumpsTokenVersion() {
        RefreshToken token = storedToken(Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(token));

        authService.logout(new RefreshTokenRequest("abc"));

        assertTrue(token.isRevoked());
        verify(refreshTokenRepository).save(token);
        verify(accounts).bumpTokenVersion(1L);
    }

    @Test
    void logoutWithUnknownTokenDoesNothing() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        authService.logout(new RefreshTokenRequest("nope"));

        verify(refreshTokenRepository, never()).save(any());
        verifyNoInteractions(accounts);
    }
}
