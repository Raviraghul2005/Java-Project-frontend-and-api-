package com.billpilot.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class SubscriptionModelTest {

    private static Subscription.SubscriptionBuilder base(Frequency frequency) {
        return Subscription.builder()
                .name("Netflix")
                .price(15.99)
                .frequency(frequency)
                .category(Category.ENTERTAINMENT)
                .paymentMethod("Credit Card")
                .user("user123");
    }

    @Test
    void testCalculateRenewalDate_MonthlyUsesCalendarMonths() {
        Subscription sub = base(Frequency.MONTHLY).startDate(LocalDate.of(2026, 1, 1)).build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(LocalDate.of(2026, 2, 1), sub.getRenewalDate());
    }

    @Test
    void testCalculateRenewalDate_MonthlyClampsToEndOfShortMonth() {
        Subscription sub = base(Frequency.MONTHLY).startDate(LocalDate.of(2026, 1, 31)).build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(LocalDate.of(2026, 2, 28), sub.getRenewalDate());
    }

    @Test
    void testCalculateRenewalDate_YearlyUsesCalendarYears() {
        Subscription sub = base(Frequency.YEARLY).startDate(LocalDate.of(2024, 2, 29)).build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(LocalDate.of(2025, 2, 28), sub.getRenewalDate());
    }

    @Test
    void testCalculateRenewalDate_Weekly() {
        LocalDate startDate = LocalDate.of(2026, 1, 1);
        Subscription sub = base(Frequency.WEEKLY).startDate(startDate).build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(startDate.plusDays(7), sub.getRenewalDate());
    }

    @Test
    void testCalculateRenewalDateDoesNotOverwriteExplicitDate() {
        LocalDate explicit = LocalDate.of(2026, 5, 20);
        Subscription sub = base(Frequency.MONTHLY).startDate(LocalDate.of(2026, 1, 1)).renewalDate(explicit).build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(explicit, sub.getRenewalDate());
    }

    @Test
    void testCalculatingRenewalDateDoesNotExpireSubscription() {
        // A start date months in the past used to produce a stale renewal date and an instantly EXPIRED subscription.
        Subscription sub = base(Frequency.MONTHLY).startDate(LocalDate.now().minusMonths(6)).build();

        sub.calculateRenewalDateIfMissing();

        assertEquals(SubscriptionStatus.ACTIVE, sub.getStatus());
    }

    @Test
    void testRollForwardAdvancesPastRenewalToNextUpcomingDate() {
        LocalDate today = LocalDate.of(2026, 10, 22);
        Subscription sub = base(Frequency.MONTHLY)
                .startDate(LocalDate.of(2026, 1, 15))
                .renewalDate(LocalDate.of(2026, 2, 15))
                .build();

        sub.rollRenewalDateForward(today);

        assertEquals(LocalDate.of(2026, 11, 15), sub.getRenewalDate());
        assertEquals(SubscriptionStatus.ACTIVE, sub.getStatus());
    }

    @Test
    void testRollForwardKeepsRenewalDueToday() {
        LocalDate today = LocalDate.of(2026, 10, 22);
        Subscription sub = base(Frequency.MONTHLY).startDate(LocalDate.of(2026, 9, 22)).renewalDate(today).build();

        sub.rollRenewalDateForward(today);

        assertEquals(today, sub.getRenewalDate());
    }

    @Test
    void testRollForwardRestoresPreferredDayAfterShortMonth() {
        // Billing on the 31st: Feb is clamped to the 28th but March must return to the 31st (no drift).
        Subscription sub = base(Frequency.MONTHLY)
                .startDate(LocalDate.of(2026, 1, 31))
                .renewalDate(LocalDate.of(2026, 2, 28))
                .build();

        sub.rollRenewalDateForward(LocalDate.of(2026, 3, 2)); // two days after Feb 28: past the one-day grace

        assertEquals(LocalDate.of(2026, 3, 31), sub.getRenewalDate());
    }

    @Test
    void testRollForwardLeavesCancelledSubscriptionsUntouched() {
        LocalDate old = LocalDate.of(2025, 1, 1);
        Subscription sub = base(Frequency.MONTHLY)
                .status(SubscriptionStatus.CANCELLED)
                .startDate(old.minusMonths(1))
                .renewalDate(old)
                .build();

        sub.rollRenewalDateForward(LocalDate.of(2026, 10, 22));

        assertEquals(old, sub.getRenewalDate());
        assertEquals(SubscriptionStatus.CANCELLED, sub.getStatus());
    }

    @Test
    void testRollForwardKeepsTheRenewalDayWhenItDiffersFromTheStartDay() {
        // Started on the 3rd, but the user set the next renewal to the 25th: the billing day is the 25th.
        Subscription sub = base(Frequency.MONTHLY)
                .startDate(LocalDate.of(2026, 1, 3))
                .renewalDate(LocalDate.of(2026, 7, 25))
                .build();

        sub.rollRenewalDateForward(LocalDate.of(2026, 10, 22));

        assertEquals(LocalDate.of(2026, 10, 25), sub.getRenewalDate());
    }

    @Test
    void testRollForwardGivesOneDayGraceForTimezoneDifferences() {
        LocalDate today = LocalDate.of(2026, 10, 22);

        Subscription yesterday = base(Frequency.MONTHLY)
                .startDate(LocalDate.of(2026, 1, 21)).renewalDate(LocalDate.of(2026, 10, 21)).build();
        yesterday.rollRenewalDateForward(today);
        assertEquals(LocalDate.of(2026, 10, 21), yesterday.getRenewalDate(), "one day overdue must not be rolled yet");

        Subscription twoDaysAgo = base(Frequency.MONTHLY)
                .startDate(LocalDate.of(2026, 1, 20)).renewalDate(LocalDate.of(2026, 10, 20)).build();
        twoDaysAgo.rollRenewalDateForward(today);
        assertEquals(LocalDate.of(2026, 11, 20), twoDaysAgo.getRenewalDate());
    }
}
