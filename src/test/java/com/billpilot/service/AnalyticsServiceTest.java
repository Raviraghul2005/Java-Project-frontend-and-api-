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

    private Subscription active(String id, String name, double price, Frequency frequency, Category category, String currency) {
        return Subscription.builder().id(id).name(name).price(price).currency(currency).frequency(frequency)
                .category(category).status(SubscriptionStatus.ACTIVE)
                .renewalDate(LocalDate.now().plusDays(15)).user("user-123").build();
    }

    @Test
    void currenciesAreNeverSummedTogether() {
        Subscription usd1 = active("1", "Netflix", 15.0, Frequency.MONTHLY, Category.ENTERTAINMENT, "USD");
        Subscription usd2 = active("2", "Claude", 20.0, Frequency.MONTHLY, Category.TECHNOLOGY, "USD");
        Subscription inr = active("3", "Hotstar", 1499.0, Frequency.MONTHLY, Category.ENTERTAINMENT, "INR");
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(usd1, usd2, inr));

        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(testUser);

        assertEquals("USD", response.getCurrency());
        assertEquals(35.0, response.getTotalMonthlySpend());
        assertEquals(2, response.getActiveCount());
        assertEquals(List.of("INR"), response.getExcludedCurrencies());
        assertEquals(1, response.getExcludedSubscriptionCount());
    }

    @Test
    void currencyTieGoesToUsdThenAlphabetical() {
        Subscription usd = active("1", "Netflix", 15.0, Frequency.MONTHLY, Category.ENTERTAINMENT, "USD");
        Subscription inr = active("2", "Hotstar", 1499.0, Frequency.MONTHLY, Category.ENTERTAINMENT, "INR");
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(inr, usd));
        assertEquals("USD", analyticsService.computeAnalyticsAudit(testUser).getCurrency());

        Subscription eur = active("3", "Spotify", 10.0, Frequency.MONTHLY, Category.ENTERTAINMENT, "EUR");
        Subscription gbp = active("4", "Disney", 8.0, Frequency.MONTHLY, Category.ENTERTAINMENT, "GBP");
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(gbp, eur));
        assertEquals("EUR", analyticsService.computeAnalyticsAudit(testUser).getCurrency());
    }

    @Test
    void subscriptionWithoutCategoryDoesNotBreakTheAudit() {
        Subscription legacy = active("1", "Legacy", 10.0, Frequency.MONTHLY, null, "USD");
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(legacy));

        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(testUser);

        assertEquals(1, response.getActiveCount());
        assertEquals("other", response.getVampireProjections().get(0).getCategory());
    }

    @Test
    void monthlyEquivalentsUseExactCalendarFactors() {
        Subscription weekly = active("1", "Weekly", 12.0, Frequency.WEEKLY, Category.NEWS, "USD");
        Subscription yearly = active("2", "Yearly", 120.0, Frequency.YEARLY, Category.OTHER, "USD");
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(weekly, yearly));

        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(testUser);

        // 12 * 52 / 12 = 52.00 per month for the weekly plan, plus 10.00 for the yearly one
        assertEquals(62.0, response.getTotalMonthlySpend());
    }

    @Test
    void pastRenewalDateIsRolledForwardSoTheSubscriptionStillCountsTowardsCollisions() {
        Subscription stale = active("1", "Stale", 10.0, Frequency.MONTHLY, Category.OTHER, "USD");
        stale.setStartDate(LocalDate.now().minusMonths(3));
        stale.setRenewalDate(LocalDate.now().minusMonths(2));
        when(subscriptionRepository.findByUser("user-123")).thenReturn(List.of(stale));

        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(testUser);

        assertEquals(1, response.getCollisionTimeline().size());
        assertFalse(response.getCollisionTimeline().get(0).getDate().isBefore(LocalDate.now()));
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
