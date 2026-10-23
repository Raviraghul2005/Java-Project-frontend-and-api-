package com.billpilot.statement;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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

    @Test
    void sharedAppleDescriptorRevealsThreeSubscriptions() {
        List<DetectedSubscription> out = detector.detect(appleRows());

        assertEquals(3, out.size());
        assertTrue(out.stream().allMatch(d -> "Apple".equals(d.getSharedDescriptor())));
        assertTrue(out.stream().noneMatch(DetectedSubscription::isKnownMerchant));

        DetectedSubscription a = byAmount(out, 2.99);
        assertEquals(Frequency.MONTHLY, a.getFrequency());
        assertEquals(14, a.getAnchorDay());
        assertEquals(3, a.getGroupedCharges());
        assertEquals(12, a.getOccurrences());
        assertEquals("Apple subscription · 2.99 on the 14th", a.getName());
        assertEquals("apple#MONTHLY#14#2.99", a.getStreamId());
        assertEquals("12 charges on about the 14th under APPLE.COM/BILL; 3 were part of a grouped charge", a.getEvidence());
        assertEquals("active", a.getStatus());
        assertEquals(12, a.getCharges().size());

        DetectedSubscription b = byAmount(out, 10.99);
        assertEquals(Frequency.MONTHLY, b.getFrequency());
        assertEquals(15, b.getAnchorDay());
        assertEquals(3, b.getGroupedCharges());
        assertEquals(12, b.getOccurrences());

        DetectedSubscription c = byAmount(out, 5.99);
        assertEquals(3, c.getAnchorDay());
        assertEquals(4.99, c.getPreviousAmount());
        assertEquals(LocalDate.parse("2026-06-03"), c.getPriceChangedOn());
    }

    @Test
    void sharedDescriptorSummaryListsTheChargesNoStreamExplains() {
        Detection detection = detector.detectDetailed(appleRows());

        assertEquals(1, detection.sharedDescriptors().size());
        SharedDescriptorSummary s = detection.sharedDescriptors().get(0);
        assertEquals("apple", s.key());
        assertEquals("Apple", s.label());
        assertEquals("APPLE.COM/BILL", s.descriptor());
        assertEquals(36, s.chargeCount());
        assertEquals(3, s.subscriptionCount());
        assertEquals(s.oneOffs().size(), s.oneOffCount());
        assertTrue(s.oneOffCount() > 0);
        assertTrue(s.oneOffTotal() > 0);
    }

    @Test
    void sameMerchantTwoPlansAreSplit() {
        List<Transaction> txns = new ArrayList<>();
        for (int m = 1; m <= 6; m++) {
            txns.add(new Transaction(LocalDate.of(2026, m, 5), "GYM FIT24 PVT LTD", 29.0));
            txns.add(new Transaction(LocalDate.of(2026, m, 20), "GYM FIT24 PVT LTD", 29.0));
        }

        List<DetectedSubscription> out = detector.detect(txns);

        assertEquals(2, out.size());
        assertEquals(Set.of(5, 20), out.stream().map(DetectedSubscription::getAnchorDay).collect(Collectors.toSet()));
        assertTrue(out.stream().allMatch(d -> d.getSharedDescriptor() == null));
        assertEquals(2, out.stream().map(DetectedSubscription::getStreamId).distinct().count());
        assertEquals(Set.of("Gym Fit · 29.00 on the 5th", "Gym Fit · 29.00 on the 20th"),
                out.stream().map(DetectedSubscription::getName).collect(Collectors.toSet()));
        // an ordinary merchant is named by the detection, not by the cleaned descriptor
        assertTrue(out.get(0).getEvidence().contains(" under Gym Fit"), out.get(0).getEvidence());
    }

    @Test
    void ordinaryDetectionsCarryTheNewFields() {
        DetectedSubscription d = detector.detect(List.of(
                tx("2026-05-02", "NETFLIX.COM 8007", 15.49),
                tx("2026-06-02", "NETFLIX.COM 8007", 15.49),
                tx("2026-07-02", "NETFLIX.COM 8007", 15.49))).get(0);

        assertEquals("netflix", d.getStreamId());
        assertNull(d.getSharedDescriptor());
        assertEquals(2, d.getAnchorDay());
        assertEquals(0, d.getGroupedCharges());
        assertEquals("active", d.getStatus());
        assertNull(d.getPriceChangedOn());
        assertEquals(3, d.getCharges().size());
        assertFalse(d.getCharges().get(0).isGrouped());
    }

    @Test
    void ordinalHandlesTeensAndSuffixes() {
        assertEquals("1st", RecurringDetector.ordinal(1));
        assertEquals("2nd", RecurringDetector.ordinal(2));
        assertEquals("3rd", RecurringDetector.ordinal(3));
        assertEquals("4th", RecurringDetector.ordinal(4));
        assertEquals("11th", RecurringDetector.ordinal(11));
        assertEquals("12th", RecurringDetector.ordinal(12));
        assertEquals("13th", RecurringDetector.ordinal(13));
        assertEquals("21st", RecurringDetector.ordinal(21));
        assertEquals("22nd", RecurringDetector.ordinal(22));
        assertEquals("23rd", RecurringDetector.ordinal(23));
        assertEquals("31st", RecurringDetector.ordinal(31));
    }

    @Test
    void planNamesFollowTheCadence() {
        assertEquals("on the 14th", RecurringDetector.schedule(Frequency.MONTHLY, 14, LocalDate.parse("2026-03-14")));
        assertEquals("every Monday", RecurringDetector.schedule(Frequency.WEEKLY, 4, LocalDate.parse("2026-05-04")));
        assertEquals("every year on 14 Mar", RecurringDetector.schedule(Frequency.YEARLY, 14, LocalDate.parse("2026-03-14")));
    }

    @Test
    void weeklyAndYearlySharedStreamsAreNamedByWeekdayAndDate() {
        List<Transaction> weekly = new ArrayList<>();
        LocalDate monday = LocalDate.parse("2026-05-04");
        for (int i = 0; i < 6; i++) weekly.add(new Transaction(monday.plusWeeks(i), "PAYPAL *CLUBX", 9.99));
        DetectedSubscription w = detector.detect(weekly).get(0);
        assertEquals(Frequency.WEEKLY, w.getFrequency());
        assertEquals("PayPal subscription · 9.99 every Monday", w.getName());
        assertEquals("6 charges about every Monday under PAYPAL", w.getEvidence());

        DetectedSubscription y = detector.detect(List.of(
                tx("2025-03-14", "APPLE.COM/BILL 866-712-7753", 49.99),
                tx("2026-03-14", "APPLE.COM/BILL 866-712-7753", 49.99))).get(0);
        assertEquals(Frequency.YEARLY, y.getFrequency());
        assertEquals("Apple subscription · 49.99 every year on 14 Mar", y.getName());
    }

    /** The Apple rows of the shared-descriptor sample statement: three plans, grouped debits, one price change. */
    private static List<Transaction> appleRows() {
        return List.of(
                tx("2025-11-03", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2025-11-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2025-11-16", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2025-12-03", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2025-12-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2025-12-15", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-01-03", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2026-01-15", "APPLE.COM/BILL 866-712-7753", 13.98),
                tx("2026-02-03", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2026-02-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-02-15", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-03-05", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2026-03-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-03-16", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-03-22", "APPLE.COM/BILL 866-712-7753", 1.99),
                tx("2026-04-03", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2026-04-15", "APPLE.COM/BILL 866-712-7753", 13.98),
                tx("2026-05-03", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2026-05-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-05-16", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-06-03", "APPLE.COM/BILL 866-712-7753", 5.99),
                tx("2026-06-09", "APPLE.COM/BILL 866-712-7753", 0.99),
                tx("2026-06-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-06-15", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-07-03", "APPLE.COM/BILL 866-712-7753", 5.99),
                tx("2026-07-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-07-16", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-08-03", "APPLE.COM/BILL 866-712-7753", 5.99),
                tx("2026-08-15", "APPLE.COM/BILL 866-712-7753", 13.98),
                tx("2026-09-03", "APPLE.COM/BILL 866-712-7753", 5.99),
                tx("2026-09-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-09-16", "APPLE.COM/BILL 866-712-7753", 10.99),
                tx("2026-09-27", "APPLE.COM/BILL 866-712-7753", 4.99),
                tx("2026-10-03", "APPLE.COM/BILL 866-712-7753", 5.99),
                tx("2026-10-14", "APPLE.COM/BILL 866-712-7753", 2.99),
                tx("2026-10-15", "APPLE.COM/BILL 866-712-7753", 10.99)
        );
    }

    @Test
    void twoIdenticalStreamsGetDistinctStreamIds() {
        // two separate subscriptions, same price, same billing day, both billed as APPLE.COM/BILL
        List<Transaction> txns = new ArrayList<>();
        for (int m = 1; m <= 6; m++) {
            txns.add(new Transaction(LocalDate.of(2026, m, 14), "APPLE.COM/BILL 866-712-7753", 2.99));
            txns.add(new Transaction(LocalDate.of(2026, m, 14), "APPLE.COM/BILL 866-712-7753", 2.99));
        }

        List<DetectedSubscription> out = detector.detect(txns);

        assertEquals(2, out.size());
        assertEquals(List.of("apple#MONTHLY#14#2.99", "apple#MONTHLY#14#2.99#2"),
                out.stream().map(DetectedSubscription::getStreamId).sorted().toList());
        assertTrue(out.stream().allMatch(d -> d.getAmount() == 2.99 && d.getAnchorDay() == 14 && d.getOccurrences() == 6));
    }

    @Test
    void streamIdsStayUniqueWhenThereAreThreeIdenticalStreams() {
        List<Transaction> txns = new ArrayList<>();
        for (int m = 1; m <= 6; m++) {
            for (int copy = 0; copy < 3; copy++) {
                txns.add(new Transaction(LocalDate.of(2026, m, 14), "APPLE.COM/BILL 866-712-7753", 2.99));
            }
        }

        List<DetectedSubscription> out = detector.detect(txns);

        assertEquals(3, out.size());
        assertEquals(Set.of("apple#MONTHLY#14#2.99", "apple#MONTHLY#14#2.99#2", "apple#MONTHLY#14#2.99#3"),
                out.stream().map(DetectedSubscription::getStreamId).collect(Collectors.toSet()));
    }

    @Test
    void aDescriptorWithTooManyChargesFallsBackToThePlainRules() {
        List<Transaction> flood = new ArrayList<>();
        LocalDate day = LocalDate.parse("2025-01-01");
        for (int i = 0; i <= RecurringDetector.MAX_SEPARATED_CHARGES; i++) {
            flood.add(new Transaction(day.plusDays(i % 360), "APPLE.COM/BILL 866-712-7753", 2.99));
        }

        Detection detection = detector.detectDetailed(flood);

        // no separator run, so no shared-descriptor summary; the plain rules find no single cadence in this
        assertTrue(detection.sharedDescriptors().isEmpty());
        assertTrue(detection.detected().isEmpty());
    }

    private static DetectedSubscription byAmount(List<DetectedSubscription> list, double amount) {
        return list.stream().filter(d -> d.getAmount() == amount).findFirst().orElseThrow();
    }
}
