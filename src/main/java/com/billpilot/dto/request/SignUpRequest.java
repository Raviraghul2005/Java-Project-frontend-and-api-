package com.billpilot.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignUpRequest {

    @NotBlank(message = "User Name is required")
    @Size(min = 2, max = 50, message = "User Name must be between 2 and 50 characters")
    private String name;

    @NotBlank(message = "User Email is required")
    @Email(message = "Please enter a valid email address")
    private String email;

    @NotBlank(message = "User Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;
}
