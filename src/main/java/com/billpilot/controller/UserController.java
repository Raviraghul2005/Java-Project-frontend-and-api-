package com.billpilot.controller;

import com.billpilot.dto.response.ApiResponse;
import com.billpilot.dto.response.UserResponse;
import com.billpilot.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        List<UserResponse> users = userService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.<List<UserResponse>>builder()
                .success(true)
                .data(users)
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable String id) {
        UserResponse user = userService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .success(true)
                .data(user)
                .build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .success(true)
                .message("User deleted successfully")
                .build());
    }
}
