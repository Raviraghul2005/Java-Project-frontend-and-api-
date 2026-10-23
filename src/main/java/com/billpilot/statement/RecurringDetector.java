package com.billpilot.statement;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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

    /** Groups of at least this many charges are also tried for several plans under one merchant. */
    private static final int MIN_CHARGES_FOR_SPLIT = 4;
    /**
     * Above this many charges under one descriptor the separator is skipped and the plain rules run, as they did before
     * it existed. The separator's cost grows much faster than linearly (about 4 s for 600 charges and a minute for 1200),
     * and no real statement has this many charges under one subscription descriptor.
     */
    static final int MAX_SEPARATED_CHARGES = 400;

    public List<DetectedSubscription> detect(List<Transaction> transactions) {
        return detectDetailed(transactions).detected();
    }

    public Detection detectDetailed(List<Transaction> transactions) {
        if (transactions.isEmpty()) return new Detection(List.of(), List.of());

        // One separator per call: it keeps its working state in fields and locks while it runs, so a shared instance
        // would make every upload wait for the slowest one.
        StreamSeparator separator = new StreamSeparator();

        // One statement span for every group, so a stream's missing charges are judged against the whole statement.
        LocalDate spanStart = transactions.stream().map(Transaction::date).min(Comparator.naturalOrder()).get();
        LocalDate spanEnd = transactions.stream().map(Transaction::date).max(Comparator.naturalOrder()).get();

        Map<String, List<Transaction>> groups = new LinkedHashMap<>();
        for (Transaction t : transactions) {
            String key = MerchantNormalizer.key(t.description());
            if (key.isEmpty()) continue;
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }

        List<DetectedSubscription> result = new ArrayList<>();
        List<SharedDescriptorSummary> summaries = new ArrayList<>();
        for (Map.Entry<String, List<Transaction>> e : groups.entrySet()) {
            String key = e.getKey();
            List<Transaction> group = e.getValue();
            String description = group.get(0).description();
            var aggregator = MerchantNormalizer.aggregator(description);

            if (aggregator.isPresent() && group.size() <= MAX_SEPARATED_CHARGES) {
                // Shared biller: several subscriptions hide under one descriptor, so the single-cadence rule can't apply.
                var a = aggregator.get();
                StreamSeparator.Result r = separator.separate(group, spanStart, spanEnd, a.groupsPurchases());
                for (StreamSeparator.Stream s : r.streams()) result.add(fromStream(key, s, a, null, description));
                summaries.add(summary(key, a.label(), group, r));
                continue;
            }

            DetectedSubscription d = evaluate(key, group);
            if (group.size() >= MIN_CHARGES_FOR_SPLIT && group.size() <= MAX_SEPARATED_CHARGES) {
                var merchant = MerchantCatalog.find(MerchantNormalizer.clean(description));
                StreamSeparator.Result r = separator.separate(group, spanStart, spanEnd, false);
                // Weekly purchases at an unknown shop are habits, same rule as evaluate().
                List<StreamSeparator.Stream> streams = r.streams().stream()
                        .filter(s -> merchant.isPresent() || s.frequency() != Frequency.WEEKLY)
                        .toList();
                if (streams.size() >= 2) {
                    // One merchant, several plans.
                    for (StreamSeparator.Stream s : streams) result.add(fromStream(key, s, null, merchant.orElse(null), description));
                    continue;
                }
                if (d == null && streams.size() == 1) {
                    result.add(fromStream(key, streams.get(0), null, merchant.orElse(null), description));
                    continue;
                }
            }
            if (d != null) result.add(d);
        }
        result.sort(Comparator.comparingInt(DetectedSubscription::getConfidence).reversed()
                .thenComparing(Comparator.comparingDouble(DetectedSubscription::getMonthlyAmount).reversed()));
        makeStreamIdsUnique(result);
        return new Detection(result, summaries);
    }

    /**
     * Two subscriptions with the same price on the same billing day (two identical plans) get the same id from
     * {@link #fromStream}; the later ones become "...#2", "...#3" so every id is unique in the response.
     */
    private static void makeStreamIdsUnique(List<DetectedSubscription> detections) {
        Set<String> seen = new HashSet<>();
        for (DetectedSubscription d : detections) {
            String id = d.getStreamId();
            String unique = id;
            for (int n = 2; !seen.add(unique); n++) unique = id + "#" + n;
            d.setStreamId(unique);
        }
    }

    private static SharedDescriptorSummary summary(String key, String label, List<Transaction> group, StreamSeparator.Result r) {
        double oneOffTotal = r.unexplained().stream().mapToDouble(StreamSeparator.Leftover::amount).sum();
        return new SharedDescriptorSummary(key, label, descriptorOf(group.get(0).description()), group.size(), r.streams().size(),
                r.unexplained().size(), round(oneOffTotal), r.unexplained());
    }

    private static DetectedSubscription fromStream(String key, StreamSeparator.Stream s, AggregatorCatalog.Aggregator aggregator,
                                            MerchantCatalog.Merchant merchant, String description) {
        String amountText = String.format(Locale.ROOT, "%.2f", s.amount());
        String when = schedule(s.frequency(), s.anchorDay(), billingDate(s));
        String baseName = merchant != null ? merchant.name() : titleCase(key);
        String name = (aggregator != null ? aggregator.label() + " subscription" : baseName)
                + " · " + amountText + " " + when;
        String status = s.stopped() ? "stopped" : s.overdue() ? "overdue" : "active";

        // Shared billers are named by their descriptor; an ordinary merchant by the detection's own name.
        StringBuilder evidence = new StringBuilder(String.format(Locale.ROOT, "%d charges %s under %s", s.occurrences(),
                s.frequency() == Frequency.MONTHLY ? "on about the " + ordinal(s.anchorDay()) : "about " + when,
                aggregator != null ? descriptorOf(description) : baseName));
        if (s.combinedHits() > 0) {
            evidence.append(String.format(Locale.ROOT, "; %d were part of a grouped charge", s.combinedHits()));
        }
        if (s.previousAmount() != null) {
            evidence.append(String.format(Locale.ROOT, "; price changed from %.2f on %s", s.previousAmount(), s.priceChangedOn()));
        }
        if (s.stopped()) {
            evidence.append("; no charge since ").append(s.lastSeen()).append(", looks stopped");
        } else if (s.overdue()) {
            evidence.append("; the ").append(s.nextExpected()).append(" charge has not appeared yet");
        }

        List<DetectedSubscription.ChargeRef> charges = s.hits().stream()
                .map(h -> DetectedSubscription.ChargeRef.builder()
                        .date(h.chargeDate()).amount(round(h.share())).grouped(h.combined()).build())
                .toList();

        return DetectedSubscription.builder()
                .name(name)
                .merchantKey(key)
                .category(merchant != null ? merchant.category() : Category.OTHER)
                .frequency(s.frequency())
                .amount(s.amount())
                .monthlyAmount(round(toMonthly(s.amount(), s.frequency())))
                .occurrences(s.occurrences())
                .firstSeen(s.firstSeen())
                .lastSeen(s.lastSeen())
                .nextExpected(s.stopped() ? null : s.nextExpected())
                .confidence(s.confidence())
                .knownMerchant(merchant != null)
                .previousAmount(s.previousAmount())
                .evidence(evidence.toString())
                .streamId(key + "#" + s.frequency() + "#" + s.anchorDay() + "#" + amountText)
                .sharedDescriptor(aggregator != null ? aggregator.label() : null)
                .anchorDay(s.anchorDay())
                .groupedCharges(s.combinedHits())
                .status(status)
                .priceChangedOn(s.priceChangedOn())
                .charges(charges)
                .build();
    }

    /** "APPLE.COM/BILL 866-712-7753" -> "APPLE.COM/BILL": the descriptor without reference numbers. */
    private static String descriptorOf(String description) {
        String head = description.split("\\*", 2)[0];
        String words = Arrays.stream(head.trim().split("\\s+"))
                .filter(w -> w.chars().noneMatch(Character::isDigit))
                .collect(Collectors.joining(" "));
        return words.isBlank() ? description.trim() : words;
    }

    /** A date on the stream's billing day: the first due date shifted by the earliest posting offset (see the separator). */
    private static LocalDate billingDate(StreamSeparator.Stream s) {
        long minOffset = s.hits().stream()
                .mapToLong(h -> ChronoUnit.DAYS.between(h.due(), h.chargeDate())).min().orElse(0);
        return s.hits().get(0).due().plusDays(minOffset);
    }

    /** "on the 14th" (monthly), "every Monday" (weekly), "every year on 14 Mar" (yearly). */
    static String schedule(Frequency frequency, int anchorDay, LocalDate billingDate) {
        return switch (frequency) {
            case WEEKLY -> "every " + billingDate.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            case YEARLY -> "every year on " + billingDate.getDayOfMonth() + " "
                    + billingDate.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            default -> "on the " + ordinal(anchorDay);
        };
    }

    static String ordinal(int n) {
        int mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 13) return n + "th";
        return switch (n % 10) {
            case 1 -> n + "st";
            case 2 -> n + "nd";
            case 3 -> n + "rd";
            default -> n + "th";
        };
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
                .streamId(key)
                .anchorDay(last.date().getDayOfMonth())
                .groupedCharges(0)
                .status("active")
                .charges(txns.stream()
                        .map(t -> DetectedSubscription.ChargeRef.builder()
                                .date(t.date()).amount(t.amount()).grouped(false).build())
                        .toList())
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
            case DAILY -> amount * 365.0 / 12.0;
            case WEEKLY -> amount * 52.0 / 12.0;
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
