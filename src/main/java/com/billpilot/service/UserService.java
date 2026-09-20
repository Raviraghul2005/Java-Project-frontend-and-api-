package com.billpilot.service;

import com.billpilot.dto.response.UserResponse;
import com.billpilot.exception.ResourceNotFoundException;
import com.billpilot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::fromEntity)
                .toList();
    }

    public UserResponse getUserById(String id) {
        return userRepository.findById(id)
                .map(UserResponse::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public void deleteUser(String id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User not found");
        }
        userRepository.deleteById(id);
    }
}
