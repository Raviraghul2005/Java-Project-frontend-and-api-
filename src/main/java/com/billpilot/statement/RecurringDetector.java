package com.billpilot.statement;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Finds recurring charges in a list of transactions with plain rules (no ML):
 * <ol>
 *   <li>group by normalized merchant</li>
 *   <li>classify the median gap between charges as weekly / monthly / yearly</li>
 *   <li>require most gaps to match that cadence (one missed or late payment is tolerated)</li>
 *   <li>require stable amounts (strict for unknown merchants, looser for catalog merchants)</li>
 *   <li>score confidence from regularity, amount stability, number of charges and catalog match</li>
 * </ol>
 */
@Component
public class RecurringDetector {

    static final int MIN_CONFIDENCE = 50;
    private static final double MIN_REGULARITY = 0.6;

    private enum Cadence {
        WEEKLY(Frequency.WEEKLY, 7, 1),
        MONTHLY(Frequency.MONTHLY, 30, 3),
        YEARLY(Frequency.YEARLY, 365, 7);

        final Frequency frequency;
        final int days;
        final int tolerance;

        Cadence(Frequency frequency, int days, int tolerance) {
            this.frequency = frequency;
            this.days = days;
            this.tolerance = tolerance;
        }

        boolean matches(long gap) {
            return Math.abs(gap - days) <= tolerance;
        }

        static Cadence classify(double medianGap) {
            for (Cadence c : values()) {
                if (Math.abs(medianGap - c.days) <= c.tolerance) return c;
            }
            return null;
        }
    }

    public List<DetectedSubscription> detect(List<Transaction> transactions) {
        Map<String, List<Transaction>> groups = new LinkedHashMap<>();
        for (Transaction t : transactions) {
            String key = MerchantNormalizer.key(t.description());
            if (key.isEmpty()) continue;
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }

        List<DetectedSubscription> result = new ArrayList<>();
        for (Map.Entry<String, List<Transaction>> e : groups.entrySet()) {
            DetectedSubscription d = evaluate(e.getKey(), e.getValue());
            if (d != null) result.add(d);
        }
        result.sort(Comparator.comparingInt(DetectedSubscription::getConfidence).reversed()
                .thenComparing(Comparator.comparingDouble(DetectedSubscription::getMonthlyAmount).reversed()));
        return result;
    }

    private DetectedSubscription evaluate(String key, List<Transaction> group) {
        var merchant = MerchantCatalog.find(MerchantNormalizer.clean(group.get(0).description()));
        boolean known = merchant.isPresent();

        // Several charges on one day (e.g. a retried payment) count once.
        List<Transaction> txns = group.stream()
                .sorted(Comparator.comparing(Transaction::date))
                .collect(java.util.stream.Collectors.toMap(Transaction::date, t -> t, (a, b) -> b, LinkedHashMap::new))
                .values().stream().toList();

        int minOccurrences = known ? 2 : 3;
        if (txns.size() < minOccurrences) return null;

        List<Long> gaps = new ArrayList<>();
        for (int i = 1; i < txns.size(); i++) {
            gaps.add(ChronoUnit.DAYS.between(txns.get(i - 1).date(), txns.get(i).date()));
        }
        double medianGap = median(gaps.stream().map(Long::doubleValue).toList());
        Cadence cadence = Cadence.classify(medianGap);
        if (cadence == null) return null;
        // Weekly purchases at the same unknown shop (coffee, groceries) are habits, not subscriptions.
        if (!known && cadence == Cadence.WEEKLY) return null;

        long onCadence = gaps.stream().filter(cadence::matches).count();
        double regularity = (double) onCadence / gaps.size();
        if (regularity < MIN_REGULARITY) return null;

        List<Double> amounts = txns.stream().map(Transaction::amount).toList();
        double medianAmount = median(amounts);
        double spread = (amounts.stream().max(Double::compare).get() - amounts.stream().min(Double::compare).get()) / medianAmount;
        double allowedSpread = known ? 0.5 : 0.05;
        if (spread > allowedSpread) return null;
        double stability = Math.max(0, 1 - spread);

        double confidence = 100 * (0.35 * regularity
                + 0.25 * stability
                + 0.20 * Math.min(1.0, txns.size() / 4.0)
                + (known ? 0.20 : 0.0));
        int score = (int) Math.round(confidence);
        if (score < MIN_CONFIDENCE) return null;

        Transaction first = txns.get(0);
        Transaction last = txns.get(txns.size() - 1);
        double lastAmount = last.amount();
        Double previous = null;
        if (txns.size() >= 2) {
            double before = txns.get(txns.size() - 2).amount();
            if (Math.abs(before - lastAmount) > 0.01) previous = before;
        }

        String name = merchant.map(MerchantCatalog.Merchant::name).orElseGet(() -> titleCase(key));
        Category category = merchant.map(MerchantCatalog.Merchant::category).orElse(Category.OTHER);

        return DetectedSubscription.builder()
                .name(name)
                .merchantKey(key)
                .category(category)
                .frequency(cadence.frequency)
                .amount(round(lastAmount))
                .monthlyAmount(round(toMonthly(lastAmount, cadence.frequency)))
                .occurrences(txns.size())
                .firstSeen(first.date())
                .lastSeen(last.date())
                .nextExpected(nextDate(last.date(), cadence))
                .confidence(score)
                .knownMerchant(known)
                .previousAmount(previous)
                .evidence(String.format("%d charges, %d of %d gaps about every %d days%s",
                        txns.size(), onCadence, gaps.size(), cadence.days,
                        known ? ", matches a known subscription service" : ", same amount each time"))
                .build();
    }

    private static LocalDate nextDate(LocalDate last, Cadence cadence) {
        return switch (cadence) {
            case WEEKLY -> last.plusWeeks(1);
            case MONTHLY -> last.plusMonths(1);
            case YEARLY -> last.plusYears(1);
        };
    }

    static double toMonthly(double amount, Frequency f) {
        return switch (f) {
            case DAILY -> amount * 30.0;
            case WEEKLY -> amount * 4.33;
            case MONTHLY -> amount;
            case YEARLY -> amount / 12.0;
        };
    }

    private static double median(List<Double> values) {
        List<Double> sorted = values.stream().sorted().toList();
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static String titleCase(String s) {
        StringBuilder sb = new StringBuilder();
        for (String part : s.split(" ")) {
            if (part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }
}
