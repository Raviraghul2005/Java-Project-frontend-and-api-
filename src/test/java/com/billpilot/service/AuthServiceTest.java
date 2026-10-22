package com.billpilot.service;

import com.billpilot.dto.request.SignInRequest;
import com.billpilot.dto.request.SignUpRequest;
import com.billpilot.dto.response.AuthResponse;
import com.billpilot.exception.DuplicateResourceException;
import com.billpilot.exception.UnauthorizedException;
import com.billpilot.model.User;
import com.billpilot.repository.UserRepository;
import com.billpilot.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AuthServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = new BCryptPasswordEncoder(4);
        JwtService jwtService = new JwtService("test-secret-that-is-definitely-32-bytes-long!", 3_600_000);
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    private static SignUpRequest signUp(String email) {
        return SignUpRequest.builder().name("  Alex  ").email(email).password("secret123").build();
    }

    @Test
    void signUpNormalisesEmailBeforeCheckingForDuplicates() {
        when(userRepository.existsByEmail("alex@example.com")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> authService.signUp(signUp("  Alex@Example.COM ")));

        verify(userRepository).existsByEmail("alex@example.com");
        verify(userRepository, never()).save(any());
    }

    @Test
    void signUpStoresTrimmedNameLowercasedEmailAndHashedPassword() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("64f1234567890abcdef12345");
            return u;
        });

        AuthResponse response = authService.signUp(signUp("Alex@Example.com"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals("Alex", saved.getValue().getName());
        assertEquals("alex@example.com", saved.getValue().getEmail());
        assertNotEquals("secret123", saved.getValue().getPassword());
        assertTrue(passwordEncoder.matches("secret123", saved.getValue().getPassword()));
        assertNotNull(response.getToken());
    }

    @Test
    void signUpRaceOnUniqueIndexBecomesConflict() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenThrow(new DuplicateKeyException("dup"));

        assertThrows(DuplicateResourceException.class, () -> authService.signUp(signUp("a@b.co")));
    }

    @Test
    void unknownEmailAndWrongPasswordAreIndistinguishable() {
        User existing = User.builder().id("1").email("alex@example.com")
                .password(passwordEncoder.encode("right-password")).build();
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(existing));
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        UnauthorizedException wrongPassword = assertThrows(UnauthorizedException.class, () ->
                authService.signIn(SignInRequest.builder().email("alex@example.com").password("nope-nope").build()));
        UnauthorizedException unknownEmail = assertThrows(UnauthorizedException.class, () ->
                authService.signIn(SignInRequest.builder().email("ghost@example.com").password("nope-nope").build()));

        assertEquals(wrongPassword.getMessage(), unknownEmail.getMessage());
    }

    @Test
    void signInIsCaseInsensitiveOnEmail() {
        User existing = User.builder().id("64f1234567890abcdef12345").email("alex@example.com")
                .password(passwordEncoder.encode("right-password")).build();
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(existing));

        AuthResponse response = authService.signIn(SignInRequest.builder().email(" ALEX@example.com ").password("right-password").build());

        assertNotNull(response.getToken());
        assertEquals("alex@example.com", response.getUser().getEmail());
    }
}
