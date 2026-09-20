package com.billpilot.service;

import com.billpilot.dto.request.SignInRequest;
import com.billpilot.dto.request.SignUpRequest;
import com.billpilot.dto.response.AuthResponse;
import com.billpilot.dto.response.UserResponse;
import com.billpilot.exception.DuplicateResourceException;
import com.billpilot.exception.ResourceNotFoundException;
import com.billpilot.exception.UnauthorizedException;
import com.billpilot.model.User;
import com.billpilot.repository.UserRepository;
import com.billpilot.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResponse signUp(SignUpRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User already exists");
        }

        User user = User.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        User savedUser = userRepository.save(user);
        String token = jwtService.generateToken(savedUser.getId());

        return AuthResponse.builder()
                .token(token)
                .user(UserResponse.fromEntity(savedUser))
                .build();
    }

    public AuthResponse signIn(SignInRequest request) {
        User user = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User Not Found"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("Invalid Password");
        }

        String token = jwtService.generateToken(user.getId());

        return AuthResponse.builder()
                .token(token)
                .user(UserResponse.fromEntity(user))
                .build();
    }
}
