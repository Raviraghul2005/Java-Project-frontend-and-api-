package com.billpilot.statement;

import com.billpilot.model.Frequency;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StreamSeparatorTest {

    private static final String DESC = "APPLE.COM/BILL";
    private final StreamSeparator separator = new StreamSeparator();

    private static Transaction tx(String date, double amount) {
        return new Transaction(LocalDate.parse(date), DESC, amount);
    }

    /** One charge per month on {@code day}, for months {@code from}..{@code to} of 2026. */
    private static List<Transaction> monthly(int day, double amount, int from, int to) {
        List<Transaction> out = new ArrayList<>();
        for (int m = from; m <= to; m++) out.add(new Transaction(LocalDate.of(2026, m, day), DESC, amount));
        return out;
    }

    private static StreamSeparator.Stream byDay(StreamSeparator.Result r, int day) {
        return r.streams().stream().filter(s -> s.anchorDay() == day).findFirst().orElse(null);
    }

    private static final LocalDate JAN_1 = LocalDate.parse("2026-01-01");

    @Test
    void separatesTwoStreamsWithTheSamePriceOnDifferentDays() {
        List<Transaction> charges = new ArrayList<>(monthly(5, 129, 1, 6));
        charges.addAll(monthly(20, 129, 1, 6));

        StreamSeparator.Result r = separator.separate(charges, JAN_1, LocalDate.parse("2026-06-30"), false);

        assertEquals(2, r.streams().size());
        for (int day : new int[]{5, 20}) {
            StreamSeparator.Stream s = byDay(r, day);
            assertNotNull(s, "no stream on day " + day);
            assertEquals(Frequency.MONTHLY, s.frequency());
            assertEquals(129.0, s.amount());
            assertEquals(6, s.occurrences());
            assertFalse(s.stopped());
        }
        assertTrue(r.unexplained().isEmpty());
    }

    @Test
    void splitsAGroupedDebitBetweenTheStreamsDueThatDay() {
        List<Transaction> charges = new ArrayList<>();
        for (int m = 1; m <= 6; m++) {
            if (m == 3 || m == 5) {
                charges.add(new Transaction(LocalDate.of(2026, m, 11), DESC, 208)); // 149 + 59 billed together
            } else {
                charges.add(new Transaction(LocalDate.of(2026, m, 10), DESC, 149));
                charges.add(new Transaction(LocalDate.of(2026, m, 11), DESC, 59));
            }
        }

        StreamSeparator.Result r = separator.separate(charges, JAN_1, LocalDate.parse("2026-06-30"), true);

        assertEquals(2, r.streams().size());
        StreamSeparator.Stream big = r.streams().stream().filter(s -> s.amount() == 149.0).findFirst().orElseThrow();
        StreamSeparator.Stream small = r.streams().stream().filter(s -> s.amount() == 59.0).findFirst().orElseThrow();
        assertEquals(6, big.occurrences());
        assertEquals(2, big.combinedHits());
        assertEquals(6, small.occurrences());
        assertEquals(2, small.combinedHits());
        assertTrue(r.unexplained().isEmpty(), "left over: " + r.unexplained());
    }

    @Test
    void aRecurringGroupedTotalIsNotReportedAsItsOwnSubscription() {
        List<Transaction> charges = new ArrayList<>();
        for (int m = 1; m <= 8; m++) {
            if (m >= 3 && m <= 6) {
                charges.add(new Transaction(LocalDate.of(2026, m, 13), DESC, 248)); // 129 + 119
            } else {
                charges.add(new Transaction(LocalDate.of(2026, m, 13), DESC, 129));
                charges.add(new Transaction(LocalDate.of(2026, m, 12), DESC, 119));
            }
        }

        StreamSeparator.Result r = separator.separate(charges, JAN_1, LocalDate.parse("2026-08-31"), true);

        assertEquals(List.of(119.0, 129.0), r.streams().stream().map(StreamSeparator.Stream::amount).sorted().toList());
        r.streams().forEach(s -> {
            assertEquals(8, s.occurrences());
            assertEquals(4, s.combinedHits());
        });
        assertTrue(r.unexplained().isEmpty(), "left over: " + r.unexplained());
    }

    @Test
    void aPriceChangeKeepsOneStream() {
        List<Transaction> charges = new ArrayList<>(monthly(3, 179, 1, 4));
        charges.addAll(monthly(3, 199, 5, 8));

        StreamSeparator.Result r = separator.separate(charges, JAN_1, LocalDate.parse("2026-08-31"), true);

        assertEquals(1, r.streams().size());
        StreamSeparator.Stream s = r.streams().get(0);
        assertEquals(199.0, s.amount());
        assertEquals(179.0, s.previousAmount());
        assertEquals(LocalDate.parse("2026-05-03"), s.priceChangedOn());
        assertEquals(8, s.occurrences());
    }

    @Test
    void oneOffPurchasesUnderTheSameDescriptorAreLeftOver() {
        List<Transaction> charges = new ArrayList<>(monthly(15, 299, 1, 6));
        charges.add(tx("2026-01-03", 1240));
        charges.add(tx("2026-02-20", 499));
        charges.add(tx("2026-03-15", 89));
        charges.add(tx("2026-04-09", 2100));
        charges.add(tx("2026-05-27", 499));

        StreamSeparator.Result r = separator.separate(charges, JAN_1, LocalDate.parse("2026-06-30"), false);

        assertEquals(1, r.streams().size());
        assertEquals(299.0, r.streams().get(0).amount());
        assertEquals(6, r.streams().get(0).occurrences());
        assertEquals(5, r.unexplained().size());
    }

    @Test
    void reportsStoppedAndOverdueStreams() {
        StreamSeparator.Result stopped = separator.separate(monthly(8, 99, 1, 4), JAN_1, LocalDate.parse("2026-07-31"), false);
        assertTrue(stopped.streams().get(0).stopped());
        assertNull(stopped.streams().get(0).nextExpected());

        StreamSeparator.Result overdue = separator.separate(monthly(8, 99, 1, 6), JAN_1, LocalDate.parse("2026-07-31"), false);
        assertFalse(overdue.streams().get(0).stopped());
        assertTrue(overdue.streams().get(0).overdue());
        assertEquals(LocalDate.parse("2026-07-08"), overdue.streams().get(0).nextExpected());

        StreamSeparator.Result active = separator.separate(monthly(8, 99, 1, 7), JAN_1, LocalDate.parse("2026-07-31"), false);
        assertFalse(active.streams().get(0).stopped());
        assertFalse(active.streams().get(0).overdue());
        assertEquals(LocalDate.parse("2026-08-08"), active.streams().get(0).nextExpected());
    }

    @Test
    void keepsTheBillingDayAcrossShortMonths() {
        List<Transaction> charges = List.of(tx("2026-01-31", 49), tx("2026-02-28", 49), tx("2026-03-31", 49),
                tx("2026-04-30", 49), tx("2026-05-31", 49));

        StreamSeparator.Result r = separator.separate(charges, JAN_1, LocalDate.parse("2026-06-15"), false);

        assertEquals(1, r.streams().size());
        assertEquals(31, r.streams().get(0).anchorDay());
        assertEquals(5, r.streams().get(0).occurrences());
        assertEquals(LocalDate.parse("2026-06-30"), r.streams().get(0).nextExpected());
    }

    @Test
    void needsAtLeastTwoStandaloneChargesAndThreeOccurrences() {
        assertTrue(separator.separate(List.of(), JAN_1, LocalDate.parse("2026-06-30"), true).streams().isEmpty());
        assertTrue(separator.separate(monthly(9, 79, 1, 2), JAN_1, LocalDate.parse("2026-02-28"), true).streams().isEmpty());
    }

    @Test
    void resultDoesNotDependOnInputOrder() {
        List<Transaction> charges = new ArrayList<>(monthly(5, 129, 1, 6));
        charges.addAll(monthly(20, 129, 1, 6));
        charges.addAll(monthly(11, 59, 2, 6));
        StreamSeparator.Result a = separator.separate(charges, JAN_1, LocalDate.parse("2026-06-30"), true);
        Collections.reverse(charges);
        StreamSeparator.Result b = separator.separate(charges, JAN_1, LocalDate.parse("2026-06-30"), true);

        Comparator<StreamSeparator.Stream> order = Comparator.comparing(StreamSeparator.Stream::anchorDay);
        assertEquals(a.streams().stream().sorted(order).map(s -> s.anchorDay() + "/" + s.amount()).toList(),
                b.streams().stream().sorted(order).map(s -> s.anchorDay() + "/" + s.amount()).toList());
        assertEquals(3, a.streams().size());
    }
}
