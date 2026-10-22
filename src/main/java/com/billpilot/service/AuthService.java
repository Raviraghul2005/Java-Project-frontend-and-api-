package com.billpilot.service;

import com.billpilot.dto.request.SignInRequest;
import com.billpilot.dto.request.SignUpRequest;
import com.billpilot.dto.response.AuthResponse;
import com.billpilot.dto.response.UserResponse;
import com.billpilot.exception.DuplicateResourceException;
import com.billpilot.exception.UnauthorizedException;
import com.billpilot.model.User;
import com.billpilot.repository.UserRepository;
import com.billpilot.security.JwtService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AuthService {

    static final String INVALID_CREDENTIALS = "Invalid email or password";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /** Hash compared against when the email is unknown, so unknown-email and wrong-password take similar time. */
    private final String dummyPasswordHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.dummyPasswordHash = passwordEncoder.encode("bill-pilot-timing-equaliser");
    }

    public AuthResponse signUp(SignUpRequest request) {
        String email = normalizeEmail(request.getEmail());

        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("User already exists");
        }

        User user = User.builder()
                .name(request.getName().trim())
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        User savedUser;
        try {
            savedUser = userRepository.save(user);
        } catch (DuplicateKeyException e) {
            // Lost a race with a concurrent sign-up for the same email.
            throw new DuplicateResourceException("User already exists");
        }
        String token = jwtService.generateToken(savedUser.getId());

        return AuthResponse.builder()
                .token(token)
                .user(UserResponse.fromEntity(savedUser))
                .build();
    }

    public AuthResponse signIn(SignInRequest request) {
        User user = userRepository.findByEmail(normalizeEmail(request.getEmail())).orElse(null);

        if (user == null) {
            passwordEncoder.matches(request.getPassword(), dummyPasswordHash);
            throw new UnauthorizedException(INVALID_CREDENTIALS);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException(INVALID_CREDENTIALS);
        }

        String token = jwtService.generateToken(user.getId());

        return AuthResponse.builder()
                .token(token)
                .user(UserResponse.fromEntity(user))
                .build();
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
