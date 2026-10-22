package com.billpilot.service;

import com.billpilot.exception.ForbiddenException;
import com.billpilot.exception.ResourceNotFoundException;
import com.billpilot.model.Subscription;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserServiceTest {

    private UserRepository userRepository;
    private SubscriptionRepository subscriptionRepository;
    private UserService userService;
    private User alice;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        subscriptionRepository = mock(SubscriptionRepository.class);
        userService = new UserService(userRepository, subscriptionRepository);
        alice = User.builder().id("alice-id").name("Alice").email("alice@example.com").build();
    }

    @Test
    void userCanReadOwnAccount() {
        when(userRepository.findById("alice-id")).thenReturn(Optional.of(alice));
        assertEquals("alice@example.com", userService.getUserById("alice-id", alice).getEmail());
    }

    @Test
    void userCannotReadSomeoneElsesAccount() {
        assertThrows(ForbiddenException.class, () -> userService.getUserById("bob-id", alice));
        verify(userRepository, never()).findById(any());
    }

    @Test
    void userCannotDeleteSomeoneElsesAccount() {
        assertThrows(ForbiddenException.class, () -> userService.deleteUser("bob-id", alice));
        verify(userRepository, never()).deleteById(any());
    }

    @Test
    void deletingOwnAccountAlsoDeletesTheirSubscriptions() {
        Subscription s1 = Subscription.builder().id("s1").user("alice-id").build();
        when(userRepository.existsById("alice-id")).thenReturn(true);
        when(subscriptionRepository.findByUser("alice-id")).thenReturn(List.of(s1));

        userService.deleteUser("alice-id", alice);

        verify(subscriptionRepository).deleteAll(List.of(s1));
        verify(userRepository).deleteById("alice-id");
    }

    @Test
    void deletingMissingAccountIsNotFound() {
        when(userRepository.existsById("alice-id")).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> userService.deleteUser("alice-id", alice));
    }
}
