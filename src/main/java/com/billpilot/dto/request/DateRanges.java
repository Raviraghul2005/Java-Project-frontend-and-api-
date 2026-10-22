package com.billpilot.dto.request;

import java.time.LocalDate;

/** Guards against absurd dates that would overflow date arithmetic or make no business sense. */
final class DateRanges {

    private static final LocalDate MIN = LocalDate.of(1970, 1, 1);
    private static final LocalDate MAX = LocalDate.of(2200, 12, 31);

    private DateRanges() {
    }

    /** {@code null} is allowed; presence is enforced separately where required. */
    static boolean isSane(LocalDate date) {
        return date == null || (!date.isBefore(MIN) && !date.isAfter(MAX));
    }
}
