package com.billpilot.util;

import com.billpilot.model.Frequency;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RenewalCalculatorTest {

    @Test
    void firstRenewalAddsOneCalendarPeriod() {
        LocalDate start = LocalDate.of(2026, 3, 10);
        assertEquals(LocalDate.of(2026, 3, 11), RenewalCalculator.firstRenewal(start, Frequency.DAILY));
        assertEquals(LocalDate.of(2026, 3, 17), RenewalCalculator.firstRenewal(start, Frequency.WEEKLY));
        assertEquals(LocalDate.of(2026, 4, 10), RenewalCalculator.firstRenewal(start, Frequency.MONTHLY));
        assertEquals(LocalDate.of(2027, 3, 10), RenewalCalculator.firstRenewal(start, Frequency.YEARLY));
    }

    @Test
    void yearlyUsesCalendarYearsNotFixed365Days() {
        // 2024 is a leap year: start + 365 days would land on 2024-12-31, not the anniversary.
        assertEquals(LocalDate.of(2025, 1, 1), RenewalCalculator.firstRenewal(LocalDate.of(2024, 1, 1), Frequency.YEARLY));
    }

    @Test
    void rollForwardReturnsAnchorWhenNotInThePast() {
        LocalDate today = LocalDate.of(2026, 10, 22);
        assertEquals(today, RenewalCalculator.rollForward(today, Frequency.MONTHLY, today, 22));
        assertEquals(today.plusDays(3), RenewalCalculator.rollForward(today.plusDays(3), Frequency.MONTHLY, today, 25));
    }

    @Test
    void rollForwardMonthlyAcrossManyMonths() {
        LocalDate anchor = LocalDate.of(2024, 1, 15);
        LocalDate today = LocalDate.of(2026, 10, 22);
        assertEquals(LocalDate.of(2026, 11, 15), RenewalCalculator.rollForward(anchor, Frequency.MONTHLY, today, 15));
    }

    @Test
    void rollForwardWeeklyAndDaily() {
        LocalDate today = LocalDate.of(2026, 10, 22); // Thursday
        LocalDate weeklyAnchor = LocalDate.of(2026, 1, 1); // also a Thursday
        assertEquals(today, RenewalCalculator.rollForward(weeklyAnchor, Frequency.WEEKLY, today, 1));
        assertEquals(today, RenewalCalculator.rollForward(LocalDate.of(2026, 10, 1), Frequency.DAILY, today, 1));
    }

    @Test
    void rollForwardYearly() {
        LocalDate anchor = LocalDate.of(2023, 12, 25);
        LocalDate today = LocalDate.of(2026, 10, 22);
        assertEquals(LocalDate.of(2026, 12, 25), RenewalCalculator.rollForward(anchor, Frequency.YEARLY, today, 25));
    }

    @Test
    void rollForwardDoesNotDriftAfterShortMonths() {
        LocalDate anchor = LocalDate.of(2026, 1, 31);
        assertEquals(LocalDate.of(2026, 2, 28), RenewalCalculator.rollForward(anchor, Frequency.MONTHLY, LocalDate.of(2026, 2, 1), 31));
        assertEquals(LocalDate.of(2026, 4, 30), RenewalCalculator.rollForward(anchor, Frequency.MONTHLY, LocalDate.of(2026, 4, 1), 31));
        assertEquals(LocalDate.of(2026, 5, 31), RenewalCalculator.rollForward(anchor, Frequency.MONTHLY, LocalDate.of(2026, 5, 1), 31));
    }

    @Test
    void leapDayYearlyFallsBackToFebruary28ThenReturnsToLeapDay() {
        LocalDate anchor = LocalDate.of(2024, 2, 29);
        assertEquals(LocalDate.of(2025, 2, 28), RenewalCalculator.rollForward(anchor, Frequency.YEARLY, LocalDate.of(2024, 3, 1), 29));
        assertEquals(LocalDate.of(2028, 2, 29), RenewalCalculator.rollForward(anchor, Frequency.YEARLY, LocalDate.of(2027, 3, 1), 29));
    }
}
