package com.billpilot.service;

import com.billpilot.dto.request.CreateSubscriptionRequest;
import com.billpilot.dto.request.UpdateSubscriptionRequest;
import com.billpilot.exception.ForbiddenException;
import com.billpilot.exception.ResourceNotFoundException;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SubscriptionService subscriptionService;

    private User testUser;
    private Subscription testSub;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id("user-123")
                .name("Tester")
                .email("tester@example.com")
                .build();

        testSub = Subscription.builder()
                .id("sub-456")
                .name("Netflix")
                .price(15.99)
                .currency("USD")
                .frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT)
                .paymentMethod("Credit Card")
                .status(SubscriptionStatus.ACTIVE)
                .startDate(LocalDate.now().minusDays(5))
                .renewalDate(LocalDate.now().plusDays(25))
                .user("user-123")
                .build();
    }

    @Test
    void testCreateSubscriptionCalculatesRenewalDate() {
        LocalDate start = LocalDate.now();
        CreateSubscriptionRequest request = CreateSubscriptionRequest.builder()
                .name("Spotify")
                .price(11.99)
                .currency("USD")
                .frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT)
                .paymentMethod("PayPal")
                .startDate(start)
                .build();

        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(inv -> inv.getArgument(0));

        Subscription result = subscriptionService.createSubscription(request, "user-123");

        assertNotNull(result);
        assertEquals("Spotify", result.getName());
        assertEquals("user-123", result.getUser());
        assertEquals(start.plusMonths(1), result.getRenewalDate());
        assertEquals(SubscriptionStatus.ACTIVE, result.getStatus());
        verify(subscriptionRepository).save(any(Subscription.class));
    }

    @Test
    void testCreateSubscriptionWithOldStartDateIsActiveWithUpcomingRenewal() {
        LocalDate today = LocalDate.now();
        CreateSubscriptionRequest request = CreateSubscriptionRequest.builder()
                .name("Old Gym")
                .price(30.0)
                .frequency(Frequency.MONTHLY)
                .category(Category.LIFESTYLE)
                .paymentMethod("Card")
                .startDate(today.minusMonths(7).minusDays(3))
                .build();

        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(inv -> inv.getArgument(0));

        Subscription result = subscriptionService.createSubscription(request, "user-123");

        assertEquals(SubscriptionStatus.ACTIVE, result.getStatus());
        assertFalse(result.getRenewalDate().isBefore(today), "renewal must be today or later");
        assertTrue(result.getRenewalDate().isBefore(today.plusMonths(1).plusDays(1)), "renewal must be within one period");
    }

    @Test
    void testGetSubscriptionByIdForbiddenForOtherUsersSubscription() {
        testSub.setUser("someone-else");
        when(subscriptionRepository.findById("sub-456")).thenReturn(Optional.of(testSub));

        assertThrows(ForbiddenException.class, () -> subscriptionService.getSubscriptionById("sub-456", testUser));
    }

    @Test
    void testGetUserSubscriptionsForbiddenWhenNotOwner() {
        User otherUser = User.builder().id("other-789").build();

        assertThrows(ForbiddenException.class, () ->
                subscriptionService.getUserSubscriptions("user-123", otherUser));
    }

    @Test
    void testGetUserSubscriptionsSuccessWhenOwner() {
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(testSub));

        List<Subscription> result = subscriptionService.getUserSubscriptions("user-123", testUser);

        assertEquals(1, result.size());
        assertEquals("Netflix", result.get(0).getName());
    }

    @Test
    void testCancelSubscriptionUpdatesStatus() {
        when(subscriptionRepository.findById("sub-456")).thenReturn(Optional.of(testSub));
        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(inv -> inv.getArgument(0));

        Subscription cancelled = subscriptionService.cancelSubscription("sub-456", testUser);

        assertEquals(SubscriptionStatus.CANCELLED, cancelled.getStatus());
        verify(subscriptionRepository).save(testSub);
    }

    @Test
    void testGetUpcomingRenewalsFiltersProperly() {
        Subscription renewingSoon = Subscription.builder()
                .id("sub-soon")
                .name("Due Soon")
                .status(SubscriptionStatus.ACTIVE)
                .renewalDate(LocalDate.now().plusDays(3))
                .user("user-123")
                .build();

        Subscription renewingFar = Subscription.builder()
                .id("sub-far")
                .name("Due Next Month")
                .status(SubscriptionStatus.ACTIVE)
                .renewalDate(LocalDate.now().plusDays(25))
                .user("user-123")
                .build();

        Subscription cancelledSub = Subscription.builder()
                .id("sub-cancelled")
                .name("Cancelled")
                .status(SubscriptionStatus.CANCELLED)
                .renewalDate(LocalDate.now().plusDays(2))
                .user("user-123")
                .build();

        when(subscriptionRepository.findByUser("user-123"))
                .thenReturn(List.of(renewingSoon, renewingFar, cancelledSub));

        List<Subscription> upcoming = subscriptionService.getUpcomingRenewals(testUser);

        assertEquals(1, upcoming.size());
        assertEquals("Due Soon", upcoming.get(0).getName());
    }
}
