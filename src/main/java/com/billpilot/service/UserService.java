package com.billpilot.service;

import com.billpilot.dto.response.UserResponse;
import com.billpilot.exception.ForbiddenException;
import com.billpilot.exception.ResourceNotFoundException;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final SubscriptionRepository subscriptionRepository;

    public UserResponse getUserById(String id, User authenticatedUser) {
        requireSelf(id, authenticatedUser);
        return userRepository.findById(id)
                .map(UserResponse::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public void deleteUser(String id, User authenticatedUser) {
        requireSelf(id, authenticatedUser);
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User not found");
        }
        subscriptionRepository.deleteAll(subscriptionRepository.findByUser(id));
        userRepository.deleteById(id);
    }

    private void requireSelf(String id, User authenticatedUser) {
        if (authenticatedUser == null || !authenticatedUser.getId().equals(id)) {
            throw new ForbiddenException("You can only access your own account");
        }
    }
}
