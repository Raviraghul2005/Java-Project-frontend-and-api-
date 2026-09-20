package com.billpilot.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class SubscriptionModelTest {

    @Test
    void testCalculateRenewalDate_Monthly() {
        LocalDate startDate = LocalDate.of(2026, 1, 1);
        Subscription sub = Subscription.builder()
                .name("Netflix")
                .price(15.99)
                .frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT)
                .paymentMethod("Credit Card")
                .startDate(startDate)
                .user("user123")
                .build();

        sub.calculateRenewalDateIfMissing();

        assertNotNull(sub.getRenewalDate());
        assertEquals(startDate.plusDays(30), sub.getRenewalDate());
    }

    @Test
    void testCalculateRenewalDate_Weekly() {
        LocalDate startDate = LocalDate.of(2026, 1, 1);
        Subscription sub = Subscription.builder()
                .name("News Weekly")
                .price(4.99)
                .frequency(Frequency.WEEKLY)
                .category(Category.NEWS)
                .paymentMethod("PayPal")
                .startDate(startDate)
                .user("user123")
                .build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(startDate.plusDays(7), sub.getRenewalDate());
    }

    @Test
    void testAutoExpireWhenRenewalDateIsInPast() {
        LocalDate pastDate = LocalDate.now().minusDays(10);
        Subscription sub = Subscription.builder()
                .name("Old Gym")
                .price(50.0)
                .frequency(Frequency.MONTHLY)
                .category(Category.LIFESTYLE)
                .paymentMethod("Debit Card")
                .startDate(pastDate.minusDays(30))
                .renewalDate(pastDate)
                .user("user123")
                .build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(SubscriptionStatus.EXPIRED, sub.getStatus());
    }
}
