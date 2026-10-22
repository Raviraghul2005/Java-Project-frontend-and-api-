package com.billpilot.util;

import com.billpilot.model.Frequency;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Billing-date arithmetic. Months and years are calendar-based (not 30/365 days) and the
 * intended day-of-month is preserved, so a subscription anchored on the 31st renews on
 * Jan 31, Feb 28, Mar 31 ... instead of drifting to the 28th after the first short month.
 */
public final class RenewalCalculator {

    private RenewalCalculator() {
    }

    /**
     * {@code base} advanced by {@code periods} billing periods.
     *
     * @param preferredDay the day of month the subscription is billed on (used to undo month-end clamping)
     */
    public static LocalDate addPeriods(LocalDate base, Frequency frequency, long periods, int preferredDay) {
        return switch (frequency) {
            case DAILY -> base.plusDays(periods);
            case WEEKLY -> base.plusWeeks(periods);
            case MONTHLY -> restoreDay(base.plusMonths(periods), preferredDay);
            case YEARLY -> restoreDay(base.plusYears(periods), preferredDay);
        };
    }

    /** The first renewal after a subscription starts: one billing period after {@code startDate}. */
    public static LocalDate firstRenewal(LocalDate startDate, Frequency frequency) {
        return addPeriods(startDate, frequency, 1, startDate.getDayOfMonth());
    }

    /**
     * The earliest billing date on or after {@code today} in the sequence anchored at {@code anchor}.
     * If {@code anchor} is not in the past it is returned unchanged.
     */
    public static LocalDate rollForward(LocalDate anchor, Frequency frequency, LocalDate today, int preferredDay) {
        if (!anchor.isBefore(today)) {
            return anchor;
        }

        long periods = Math.max(1, elapsedPeriods(anchor, frequency, today));
        LocalDate candidate = addPeriods(anchor, frequency, periods, preferredDay);
        while (candidate.isBefore(today)) {
            periods++;
            candidate = addPeriods(anchor, frequency, periods, preferredDay);
        }
        return candidate;
    }

    private static long elapsedPeriods(LocalDate from, Frequency frequency, LocalDate to) {
        return switch (frequency) {
            case DAILY -> ChronoUnit.DAYS.between(from, to);
            case WEEKLY -> ChronoUnit.WEEKS.between(from, to);
            case MONTHLY -> ChronoUnit.MONTHS.between(from, to);
            case YEARLY -> ChronoUnit.YEARS.between(from, to);
        };
    }

    private static LocalDate restoreDay(LocalDate date, int preferredDay) {
        return date.withDayOfMonth(Math.min(preferredDay, date.lengthOfMonth()));
    }
}
