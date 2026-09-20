package com.billpilot.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignInRequest {

    @NotBlank(message = "User Email is required")
    @Email(message = "Please enter a valid email address")
    private String email;

    @NotBlank(message = "User Password is required")
    private String password;
}
