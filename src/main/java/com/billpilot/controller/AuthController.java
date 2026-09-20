package com.billpilot.controller;

import com.billpilot.dto.request.SignInRequest;
import com.billpilot.dto.request.SignUpRequest;
import com.billpilot.dto.response.ApiResponse;
import com.billpilot.dto.response.AuthResponse;
import com.billpilot.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/sign-up")
    public ResponseEntity<ApiResponse<AuthResponse>> signUp(@Valid @RequestBody SignUpRequest request) {
        AuthResponse response = authService.signUp(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<AuthResponse>builder()
                        .success(true)
                        .message("User Created Successfully")
                        .data(response)
                        .build());
    }

    @PostMapping("/sign-in")
    public ResponseEntity<ApiResponse<AuthResponse>> signIn(@Valid @RequestBody SignInRequest request) {
        AuthResponse response = authService.signIn(request);
        return ResponseEntity.ok(ApiResponse.<AuthResponse>builder()
                .success(true)
                .message("User signed in successfully")
                .data(response)
                .build());
    }

    @PostMapping("/sign-out")
    public ResponseEntity<ApiResponse<Void>> signOut() {
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .success(true)
                .message("User signed out successfully")
                .build());
    }
}
