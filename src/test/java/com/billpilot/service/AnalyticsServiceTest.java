package com.billpilot.service;

import com.billpilot.dto.response.AnalyticsResponse;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @InjectMocks
    private AnalyticsService analyticsService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id("user-123")
                .name("Analyst")
                .email("analyst@example.com")
                .build();
    }

    @Test
    void testComputeAnalyticsAuditWithRedundanciesAndFatigue() {
        Subscription netflix = Subscription.builder()
                .id("sub-1")
                .name("Netflix")
                .price(19.99)
                .frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT)
                .status(SubscriptionStatus.ACTIVE)
                .renewalDate(LocalDate.now().plusDays(2))
                .user("user-123")
                .build();

        Subscription hulu = Subscription.builder()
                .id("sub-2")
                .name("Hulu")
                .price(14.99)
                .frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT)
                .status(SubscriptionStatus.ACTIVE)
                .renewalDate(LocalDate.now().plusDays(2)) // Collision!
                .user("user-123")
                .build();

        Subscription claude = Subscription.builder()
                .id("sub-3")
                .name("Claude Pro")
                .price(20.0)
                .frequency(Frequency.MONTHLY)
                .category(Category.TECHNOLOGY)
                .status(SubscriptionStatus.ACTIVE)
                .renewalDate(LocalDate.now().plusDays(10))
                .user("user-123")
                .build();

        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(netflix, hulu, claude));

        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(testUser);

        assertNotNull(response);
        assertEquals(3, response.getActiveCount());
        assertEquals(54.98, response.getTotalMonthlySpend());
        assertTrue(response.getFatigueIndex() > 0);
        assertNotNull(response.getFatigueLevel());

        // Check Redundancy
        assertEquals(1, response.getRedundancyCount());
        assertFalse(response.getRedundancies().isEmpty());
        assertEquals("entertainment", response.getRedundancies().get(0).getCategory());
        assertTrue(response.getRedundancies().get(0).getServiceNames().contains("Netflix"));
        assertTrue(response.getRedundancies().get(0).getServiceNames().contains("Hulu"));

        // Check Collision
        assertFalse(response.getCollisionTimeline().isEmpty());
        AnalyticsResponse.RenewalCollision collision = response.getCollisionTimeline().stream()
                .filter(c -> c.getDate().equals(LocalDate.now().plusDays(2)))
                .findFirst()
                .orElse(null);
        assertNotNull(collision);
        assertEquals(2, collision.getCount());
        assertTrue(collision.isCollisionRisk());

        // Check Vampire Opportunity Cost
        assertTrue(response.getTotal5YearOpportunityCost() > 0);
    }

    @Test
    void testComputeAnalyticsAuditWithZeroSubscriptions() {
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of());

        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(testUser);

        assertNotNull(response);
        assertEquals(0, response.getActiveCount());
        assertEquals(0.0, response.getTotalMonthlySpend());
        assertEquals(0, response.getFatigueIndex());
        assertEquals("OPTIMAL", response.getFatigueLevel());
        assertEquals(0, response.getRedundancyCount());
        assertTrue(response.getRedundancies().isEmpty());
        assertTrue(response.getVampireProjections().isEmpty());
        assertTrue(response.getCollisionTimeline().isEmpty());
        assertTrue(response.getCategoryBreakdowns().isEmpty());
    }
}
