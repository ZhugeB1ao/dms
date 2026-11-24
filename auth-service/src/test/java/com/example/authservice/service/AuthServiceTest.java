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
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    private static final String SHA256_OF_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    @Mock AccountClient accounts;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;

    AuthService authService;
    AccountInfo account;

    @BeforeEach
    void setUp() {
        authService = new AuthService(refreshTokenRepository, accounts, jwtService, passwordEncoder);
        account = AccountInfo.newBuilder()
                .setId(1L)
                .setUsername("u")
                .setRole("EMPLOYEE")
                .setDepartmentId(1L)
                .setTokenVersion(0)
                .setActive(true)
                .setMustChangePassword(false)
                .build();
    }

    private static HttpStatus statusOf(ResponseStatusException e) {
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    private RefreshToken storedToken(Instant expiresAt) {
        return RefreshToken.builder()
                .id(10L)
                .userId(1L)
                .tokenHash(SHA256_OF_ABC)
                .tokenVersion(0)
                .expiresAt(expiresAt)
                .build();
    }

    private static Credentials credentialsFor(AccountInfo info) {
        return Credentials.newBuilder().setAccount(info).setPasswordHash("hash").build();
    }

    @Test
    void loginSucceedsAndStoresOnlyTheRefreshTokenHash() {
        when(accounts.credentials("u")).thenReturn(Optional.of(credentialsFor(account)));
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);
        when(jwtService.generateAccessToken(account)).thenReturn("access");

        AuthResponse res = authService.login(new LoginRequest("u", "pw"));

        assertEquals("access", res.accessToken());
        verify(refreshTokenRepository).save(argThat(t -> !t.getTokenHash().equals(res.refreshToken())));
    }

    @Test
    void loginRejectsWrongPasswordUnknownUserAndInactiveAccount() {
        AccountInfo inactive = account.toBuilder().setActive(false).build();
        when(accounts.credentials("u")).thenReturn(Optional.of(credentialsFor(account)));
        when(accounts.credentials("ghost")).thenReturn(Optional.empty());
        when(accounts.credentials("locked")).thenReturn(Optional.of(credentialsFor(inactive)));
        when(passwordEncoder.matches("bad", "hash")).thenReturn(false);
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);

        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("u", "bad")))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("ghost", "pw")))));
        assertEquals(HttpStatus.FORBIDDEN, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("locked", "pw")))));
    }

    @Test
    void refreshRotatesTokenAndMarksOldOneRevokedAndReplaced() {
        RefreshToken old = storedToken(Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(old));
        when(accounts.find(1L)).thenReturn(Optional.of(account));
        when(jwtService.generateAccessToken(account)).thenReturn("access2");
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
    void refreshWithAlreadyUsedTokenBumpsTokenVersion() {
        RefreshToken old = storedToken(Instant.now().plusSeconds(60));
        old.setRevokedAt(Instant.now());
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(old));

        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));
        verify(accounts).bumpTokenVersion(1L);
        verify(accounts, never()).find(1L);
    }

    @Test
    void refreshRejectsBlankUnknownExpiredInactiveAndStaleVersionTokens() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest(" ")))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("nope")))));

        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC))
                .thenReturn(Optional.of(storedToken(Instant.now().minusSeconds(1))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));

        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC))
                .thenReturn(Optional.of(storedToken(Instant.now().plusSeconds(60))));
        when(accounts.find(1L)).thenReturn(Optional.of(account.toBuilder().setActive(false).build()));
        assertEquals(HttpStatus.FORBIDDEN, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));

        when(accounts.find(1L)).thenReturn(Optional.of(account.toBuilder().setTokenVersion(1).build()));
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
}