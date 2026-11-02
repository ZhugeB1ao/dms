package com.example.authservice.service;

import com.example.authservice.dto.ForgotPasswordRequest;
import com.example.authservice.dto.ResetPasswordRequest;
import com.example.authservice.entity.User;
import com.example.authservice.entity.UserRole;
import com.example.authservice.repository.RefreshTokenRepository;
import com.example.authservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServicePasswordResetTest {
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
        user = User.builder().id(1).username("u").email("u@x.com").passwordHash("old")
                .departmentId(1L).role(UserRole.EMPLOYEE).tokenVersion(3)
                .resetTokenHash(SHA256_OF_ABC).resetTokenExpiresAt(Instant.now().plusSeconds(60))
                .build();
    }

    @Test
    void resetPasswordChangesPasswordAndKillsSessions() {
        when(userRepository.findByResetTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new")).thenReturn("newHash");

        authService.resetPassword(new ResetPasswordRequest("abc", "new"));

        assertEquals("newHash", user.getPasswordHash());
        assertNull(user.getResetTokenHash());
        assertEquals(4, user.getTokenVersion());
        verify(refreshTokenRepository).revokeAllByUserId(eq(1L), any(Instant.class));
    }

    @Test
    void resetPasswordRejectsExpiredToken() {
        user.setResetTokenExpiresAt(Instant.now().minusSeconds(1));
        when(userRepository.findByResetTokenHash(SHA256_OF_ABC)).thenReturn(Optional.of(user));

        assertThrows(ResponseStatusException.class,
                () -> authService.resetPassword(new ResetPasswordRequest("abc", "new")));
        assertEquals("old", user.getPasswordHash());
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void resetPasswordRejectsUnknownTokenAndBlankPassword() {
        when(userRepository.findByResetTokenHash(any())).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> authService.resetPassword(new ResetPasswordRequest("nope", "new")));
        assertThrows(ResponseStatusException.class,
                () -> authService.resetPassword(new ResetPasswordRequest("abc", " ")));
    }

    @Test
    void forgotPasswordStoresHashedTokenOnlyForKnownEmail() {
        when(userRepository.findByEmail("u@x.com")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());

        authService.forgotPassword(new ForgotPasswordRequest("ghost@x.com"));
        verify(userRepository, never()).save(any());

        authService.forgotPassword(new ForgotPasswordRequest("u@x.com"));
        verify(userRepository).save(user);
        assertNotEquals(SHA256_OF_ABC, user.getResetTokenHash());
        assertTrue(user.getResetTokenExpiresAt().isAfter(Instant.now()));
    }
}
