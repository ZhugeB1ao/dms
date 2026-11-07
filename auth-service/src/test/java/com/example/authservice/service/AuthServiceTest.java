package com.example.authservice.service;

import com.example.authservice.dto.*;
import com.example.authservice.entity.RefreshToken;
import com.example.authservice.entity.User;
import com.example.authservice.entity.UserRole;
import com.example.authservice.repository.RefreshTokenRepository;
import com.example.authservice.repository.UserRepository;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    private static final String SHA256_OF_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;

    AuthService authService;
    User user;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, refreshTokenRepository, passwordEncoder, jwtService);
        user = User.builder().id(1).username("u").email("u@x.com").passwordHash("hash")
                .departmentId(1L).role(UserRole.EMPLOYEE).tokenVersion(0).build();
    }

    private static HttpStatus statusOf(ResponseStatusException e) {
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    private RefreshToken storedToken(Instant expiresAt) {
        return RefreshToken.builder().id(10L).userId(1L).tokenHash(SHA256_OF_ABC).expiresAt(expiresAt).build();
    }

    @Test
    void registerAlwaysCreatesEmployeeAndRejectsDuplicates() {
        when(userRepository.existsByUsername("new")).thenReturn(false);
        when(userRepository.existsByEmail("n@x.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("pwHash");
        when(jwtService.generateAccessToken(any())).thenReturn("access");

        // a client-supplied role must be ignored
        AuthResponse res = authService.register(new RegisterRequest("new", "n@x.com", "pw", 2L, "ADMIN"));

        assertEquals("access", res.accessToken());
        verify(userRepository).save(argThat(u -> u.getRole() == UserRole.EMPLOYEE && u.getPasswordHash().equals("pwHash")));

        when(userRepository.existsByUsername("dup")).thenReturn(true);
        var e = assertThrows(ResponseStatusException.class,
                () -> authService.register(new RegisterRequest("dup", "d@x.com", "pw", 2L, null)));
        assertEquals(HttpStatus.CONFLICT, statusOf(e));
    }

    @Test
    void loginSucceedsAndStoresOnlyTheRefreshTokenHash() {
        when(userRepository.findByUsername("u")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);
        when(jwtService.generateAccessToken(user)).thenReturn("access");

        AuthResponse res = authService.login(new LoginRequest("u", "pw"));

        assertEquals("access", res.accessToken());
        verify(refreshTokenRepository).save(argThat(t -> !t.getTokenHash().equals(res.refreshToken())));
    }

    @Test
    void loginRejectsWrongPasswordUnknownUserAndInactiveAccount() {
        when(userRepository.findByUsername("u")).thenReturn(Optional.of(user));
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        when(passwordEncoder.matches("bad", "hash")).thenReturn(false);
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);

        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("u", "bad")))));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("ghost", "pw")))));

        user.setActive(false);
        assertEquals(HttpStatus.FORBIDDEN, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.login(new LoginRequest("u", "pw")))));
    }

    @Test
    void refreshRotatesTokenAndMarksOldOneRevokedAndReplaced() {
        RefreshToken old = storedToken(Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(old));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
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
    void refreshWithAlreadyUsedTokenBumpsTokenVersion() {
        RefreshToken old = storedToken(Instant.now().plusSeconds(60));
        old.setRevokedAt(Instant.now());
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(old));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("abc")))));
        assertEquals(1, user.getTokenVersion());
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
    void logoutRevokesRefreshTokenAndBumpsTokenVersion() {
        RefreshToken token = storedToken(Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(token));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        authService.logout(new RefreshTokenRequest("abc"));

        assertTrue(token.isRevoked());
        assertEquals(1, user.getTokenVersion());
    }

    @Test
    void changePasswordNeedsCorrectCurrentPasswordThenKillsAllSessions() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad", "hash")).thenReturn(false);
        when(passwordEncoder.matches("pw", "hash")).thenReturn(true);
        when(passwordEncoder.encode("new")).thenReturn("newHash");

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.changePassword(1L, new ChangePasswordRequest("bad", "new")))));
        assertEquals("hash", user.getPasswordHash());

        authService.changePassword(1L, new ChangePasswordRequest("pw", "new"));

        assertEquals("newHash", user.getPasswordHash());
        assertEquals(1, user.getTokenVersion());
        verify(refreshTokenRepository).revokeAllByUserId(eq(1L), any(Instant.class));
    }

    @Test
    void changePasswordRejectsBlankNewPassword() {
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(assertThrows(ResponseStatusException.class,
                () -> authService.changePassword(1L, new ChangePasswordRequest("pw", " ")))));
    }
}
