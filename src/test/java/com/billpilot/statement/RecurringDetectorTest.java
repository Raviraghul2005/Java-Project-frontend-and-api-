package com.billpilot.statement;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RecurringDetectorTest {

    private final RecurringDetector detector = new RecurringDetector();

    private static Transaction tx(String date, String desc, double amount) {
        return new Transaction(LocalDate.parse(date), desc, amount);
    }

    private static DetectedSubscription find(List<DetectedSubscription> list, String name) {
        return list.stream().filter(d -> d.getName().equals(name)).findFirst().orElse(null);
    }

    @Test
    void detectsMonthlyKnownSubscription() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-05-02", "NETFLIX.COM 8007", 15.49),
                tx("2026-06-02", "NETFLIX.COM 8007", 15.49),
                tx("2026-07-02", "NETFLIX.COM 8007", 15.49)));

        assertEquals(1, out.size());
        DetectedSubscription d = out.get(0);
        assertEquals("Netflix", d.getName());
        assertEquals(Frequency.MONTHLY, d.getFrequency());
        assertEquals(Category.ENTERTAINMENT, d.getCategory());
        assertEquals(3, d.getOccurrences());
        assertEquals(LocalDate.parse("2026-08-02"), d.getNextExpected());
        assertTrue(d.isKnownMerchant());
        assertTrue(d.getConfidence() >= 90, "confidence was " + d.getConfidence());
        assertNull(d.getPreviousAmount());
    }

    @Test
    void flagsPriceHike() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-05-02", "NETFLIX", 15.49),
                tx("2026-06-02", "NETFLIX", 15.49),
                tx("2026-07-02", "NETFLIX", 17.99)));

        DetectedSubscription d = find(out, "Netflix");
        assertNotNull(d);
        assertEquals(17.99, d.getAmount());
        assertEquals(15.49, d.getPreviousAmount());
    }

    @Test
    void detectsYearlyKnownSubscriptionFromTwoCharges() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2025-03-10", "CANVA* 04812", 119.99),
                tx("2026-03-10", "CANVA* 77123", 119.99)));

        DetectedSubscription d = find(out, "Canva");
        assertNotNull(d);
        assertEquals(Frequency.YEARLY, d.getFrequency());
        assertEquals(10.0, d.getMonthlyAmount());
    }

    @Test
    void detectsUnknownMerchantWithIdenticalAmounts() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-05-18", "GYM FIT24 PVT LTD", 29.0),
                tx("2026-06-18", "GYM FIT24 PVT LTD", 29.0),
                tx("2026-07-18", "GYM FIT24 PVT LTD", 29.0)));

        assertEquals(1, out.size());
        assertFalse(out.get(0).isKnownMerchant());
        assertEquals(Category.OTHER, out.get(0).getCategory());
        assertEquals("Gym Fit", out.get(0).getName());
    }

    @Test
    void ignoresFrequentShopWithVaryingAmounts() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-05-03", "STARBUCKS STORE 1182", 6.20),
                tx("2026-06-03", "STARBUCKS STORE 1182", 4.80),
                tx("2026-07-03", "STARBUCKS STORE 1182", 7.10)));

        assertTrue(out.isEmpty());
    }

    @Test
    void ignoresSinglePurchase() {
        assertTrue(detector.detect(List.of(tx("2026-05-03", "SPOTIFY", 11.99))).isEmpty());
    }

    @Test
    void ignoresIrregularGaps() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-01-05", "RANDOM SHOP", 20.0),
                tx("2026-01-19", "RANDOM SHOP", 20.0),
                tx("2026-03-30", "RANDOM SHOP", 20.0),
                tx("2026-04-02", "RANDOM SHOP", 20.0)));

        assertTrue(out.isEmpty());
    }

    @Test
    void ignoresWeeklyHabitsAtUnknownMerchants() {
        List<Transaction> weekly = new ArrayList<>();
        LocalDate d = LocalDate.parse("2026-05-01");
        for (int i = 0; i < 6; i++) weekly.add(new Transaction(d.plusWeeks(i), "CORNER CAFE", 5.0));

        assertTrue(detector.detect(weekly).isEmpty());
    }

    @Test
    void toleratesOneMissedMonth() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-01-05", "SPOTIFY", 11.99),
                tx("2026-02-05", "SPOTIFY", 11.99),
                tx("2026-04-05", "SPOTIFY", 11.99),
                tx("2026-05-05", "SPOTIFY", 11.99)));

        assertEquals(1, out.size());
        assertEquals(Frequency.MONTHLY, out.get(0).getFrequency());
    }

    @Test
    void sameDayDuplicateChargeCountsOnce() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-05-02", "NETFLIX", 15.49),
                tx("2026-05-02", "NETFLIX", 15.49)));

        assertTrue(out.isEmpty());
    }

    @Test
    void resultsAreSortedByConfidenceThenSpend() {
        List<DetectedSubscription> out = detector.detect(List.of(
                tx("2026-05-02", "NETFLIX", 15.49), tx("2026-06-02", "NETFLIX", 15.49), tx("2026-07-02", "NETFLIX", 15.49),
                tx("2026-05-05", "GYM FIT24 PVT LTD", 29.0), tx("2026-06-05", "GYM FIT24 PVT LTD", 29.0),
                tx("2026-07-05", "GYM FIT24 PVT LTD", 29.0)));

        assertEquals(2, out.size());
        assertTrue(out.get(0).getConfidence() >= out.get(1).getConfidence());
    }
}
