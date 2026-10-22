package com.billpilot.service;

import com.billpilot.dto.response.AnalyticsResponse;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private static final String DEFAULT_CURRENCY = "USD";

    private final SubscriptionRepository subscriptionRepository;

    public AnalyticsResponse computeAnalyticsAudit(User user) {
        LocalDate today = LocalDate.now();
        List<Subscription> subscriptions = subscriptionRepository.findByUser(user.getId());
        // In-memory only: keeps renewal dates current between runs of the daily roll-forward job.
        subscriptions.forEach(s -> s.rollRenewalDateForward(today));

        List<Subscription> allActive = subscriptions.stream()
                .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE)
                .toList();

        // Prices in different currencies cannot be added together, so every figure below is computed in
        // the user's primary (most used) currency and the rest are reported as excluded.
        String primaryCurrency = resolvePrimaryCurrency(allActive);
        List<Subscription> activeSubs = allActive.stream()
                .filter(s -> currencyOf(s).equals(primaryCurrency))
                .toList();
        List<String> excludedCurrencies = allActive.stream()
                .map(AnalyticsService::currencyOf)
                .filter(c -> !c.equals(primaryCurrency))
                .distinct()
                .sorted()
                .toList();
        int excludedCount = allActive.size() - activeSubs.size();

        double totalMonthlySpend = 0.0;
        for (Subscription sub : activeSubs) {
            totalMonthlySpend += toMonthlyPrice(sub.getPrice(), sub.getFrequency());
        }
        totalMonthlySpend = round(totalMonthlySpend);
        double totalAnnualSpend = round(totalMonthlySpend * 12.0);

        // 1. Redundancy Matrix
        List<AnalyticsResponse.RedundancyGroup> redundancies = computeRedundancies(activeSubs);
        int redundantCount = redundancies.stream().mapToInt(r -> r.getServiceNames().size() - 1).sum();
        double potentialAnnualSavings = round(redundancies.stream().mapToDouble(AnalyticsResponse.RedundancyGroup::getPotentialAnnualSavings).sum());

        // 2. Renewal Collisions (Next 30 Days)
        List<AnalyticsResponse.RenewalCollision> collisions = computeCollisions(activeSubs);
        long collisionDayCount = collisions.stream().filter(AnalyticsResponse.RenewalCollision::isCollisionRisk).count();

        // 3. Subscription Fatigue Index (0 to 100)
        double countLoad = activeSubs.size() * 4.5;
        double spendLoad = Math.min(30.0, totalMonthlySpend / 15.0);
        double redundancyLoad = redundantCount * 12.0;
        double collisionLoad = Math.min(18.0, collisionDayCount * 6.0);

        double rawIndex = countLoad + spendLoad + redundancyLoad + collisionLoad;
        int fatigueIndex = activeSubs.isEmpty() ? 0 : Math.min(100, Math.max(5, (int) Math.round(rawIndex)));

        FatigueRating rating = activeSubs.isEmpty()
                ? new FatigueRating("OPTIMAL", "#10b981", "No active subscriptions. Clean slate with zero recurring fatigue.")
                : evaluateFatigue(fatigueIndex);

        // 4. Vampire Spend & 5-Year S&P 500 Opportunity Cost
        List<AnalyticsResponse.VampireProjection> vampireProjections = computeVampireProjections(activeSubs);
        double total5YearOpportunityCost = round(vampireProjections.stream()
                .mapToDouble(AnalyticsResponse.VampireProjection::getFiveYearOpportunityCost)
                .sum());

        // 5. Category Breakdown
        List<AnalyticsResponse.CategoryBreakdown> categoryBreakdowns = computeCategoryBreakdowns(activeSubs, totalMonthlySpend);

        return AnalyticsResponse.builder()
                .totalMonthlySpend(totalMonthlySpend)
                .totalAnnualSpend(totalAnnualSpend)
                .activeCount(activeSubs.size())
                .currency(primaryCurrency)
                .excludedCurrencies(excludedCurrencies)
                .excludedSubscriptionCount(excludedCount)
                .fatigueIndex(fatigueIndex)
                .fatigueLevel(rating.level)
                .fatigueColor(rating.color)
                .fatigueInterpretation(rating.interpretation)
                .redundancyCount(redundantCount)
                .potentialAnnualSavings(potentialAnnualSavings)
                .redundancies(redundancies)
                .total5YearOpportunityCost(total5YearOpportunityCost)
                .vampireProjections(vampireProjections)
                .collisionTimeline(collisions)
                .categoryBreakdowns(categoryBreakdowns)
                .build();
    }

    private double toMonthlyPrice(Double price, Frequency frequency) {
        if (price == null || frequency == null) return 0.0;
        return switch (frequency) {
            case DAILY -> price * 365.0 / 12.0;
            case WEEKLY -> price * 52.0 / 12.0;
            case MONTHLY -> price;
            case YEARLY -> price / 12.0;
        };
    }

    private static String currencyOf(Subscription sub) {
        String currency = sub.getCurrency();
        return currency == null || currency.isBlank() ? DEFAULT_CURRENCY : currency.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * The currency used by the most active subscriptions. Ties go to the default currency (USD),
     * then to the alphabetically first code, so the choice is stable between requests.
     */
    private static String resolvePrimaryCurrency(List<Subscription> activeSubs) {
        return activeSubs.stream()
                .collect(Collectors.groupingBy(AnalyticsService::currencyOf, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.<String, Long>comparingByValue()
                        .thenComparing(e -> DEFAULT_CURRENCY.equals(e.getKey()))
                        .thenComparing(Map.Entry.comparingByKey(Comparator.reverseOrder())))
                .map(Map.Entry::getKey)
                .orElse(DEFAULT_CURRENCY);
    }

    /** Legacy documents may lack a category; treat them as OTHER instead of failing the whole audit. */
    private static Category categoryOf(Subscription sub) {
        return sub.getCategory() != null ? sub.getCategory() : Category.OTHER;
    }

    private List<AnalyticsResponse.RedundancyGroup> computeRedundancies(List<Subscription> activeSubs) {
        Map<Category, List<Subscription>> byCategory = activeSubs.stream()
                .collect(Collectors.groupingBy(AnalyticsService::categoryOf));

        List<AnalyticsResponse.RedundancyGroup> groups = new ArrayList<>();

        for (Map.Entry<Category, List<Subscription>> entry : byCategory.entrySet()) {
            List<Subscription> catSubs = entry.getValue();
            if (catSubs.size() > 1) {
                Category cat = entry.getKey();
                double catMonthly = round(catSubs.stream()
                        .mapToDouble(s -> toMonthlyPrice(s.getPrice(), s.getFrequency()))
                        .sum());
                double catAnnual = round(catMonthly * 12.0);

                // Find highest single cost subscription
                double highestSubMonthly = catSubs.stream()
                        .mapToDouble(s -> toMonthlyPrice(s.getPrice(), s.getFrequency()))
                        .max()
                        .orElse(0.0);
                double potentialSavings = round(Math.max(0.0, (catMonthly - highestSubMonthly) * 12.0));

                String title = switch (cat) {
                    case ENTERTAINMENT -> "Streaming & Media Stack Saturation";
                    case TECHNOLOGY -> "AI Assistant & Developer Stack Overlap";
                    case NEWS -> "Multiple Journalism & Publication Subscriptions";
                    case LIFESTYLE -> "Overlapping Fitness & Lifestyle Services";
                    default -> cat.getValue().toUpperCase() + " Category Redundancy";
                };

                String rec = switch (cat) {
                    case ENTERTAINMENT -> "Consider adopting a rotational streaming policy: maintain 1 active service and rotate monthly to save up to 60%.";
                    case TECHNOLOGY -> "Consolidate overlapping AI models or tooling; audit which services have zero usage in the last 14 days.";
                    case NEWS -> "Check if student/family bundles or digital library memberships grant free access.";
                    default -> "Review and prune duplicate services within this domain to recover monthly cash flow.";
                };

                groups.add(AnalyticsResponse.RedundancyGroup.builder()
                        .category(cat.getValue())
                        .title(title)
                        .serviceNames(catSubs.stream().map(Subscription::getName).toList())
                        .monthlySpend(catMonthly)
                        .annualSpend(catAnnual)
                        .potentialAnnualSavings(potentialSavings)
                        .recommendation(rec)
                        .build());
            }
        }

        return groups;
    }

    private List<AnalyticsResponse.RenewalCollision> computeCollisions(List<Subscription> activeSubs) {
        LocalDate today = LocalDate.now();
        LocalDate windowEnd = today.plusDays(30);

        Map<LocalDate, List<Subscription>> byDate = new TreeMap<>();

        for (Subscription sub : activeSubs) {
            LocalDate renewal = sub.getRenewalDate();
            if (renewal != null && !renewal.isBefore(today) && !renewal.isAfter(windowEnd)) {
                byDate.computeIfAbsent(renewal, k -> new ArrayList<>()).add(sub);
            }
        }

        List<AnalyticsResponse.RenewalCollision> list = new ArrayList<>();
        for (Map.Entry<LocalDate, List<Subscription>> entry : byDate.entrySet()) {
            double total = round(entry.getValue().stream().mapToDouble(s -> s.getPrice() != null ? s.getPrice() : 0.0).sum());
            int count = entry.getValue().size();
            boolean risk = count >= 2 || total >= 40.0;

            list.add(AnalyticsResponse.RenewalCollision.builder()
                    .date(entry.getKey())
                    .count(count)
                    .totalCost(total)
                    .serviceNames(entry.getValue().stream().map(Subscription::getName).toList())
                    .collisionRisk(risk)
                    .build());
        }

        return list;
    }

    private List<AnalyticsResponse.VampireProjection> computeVampireProjections(List<Subscription> activeSubs) {
        // Compound interest calculation: 7% annual yield compounded monthly over 5 years (60 months)
        // Multiplier for monthly recurring deposit at 7% annual:
        // FV_factor = ((1 + 0.07/12)^60 - 1) / (0.07/12) ≈ 71.5929
        final double OPPORTUNITY_FACTOR_5YR = 71.5929;

        List<AnalyticsResponse.VampireProjection> list = new ArrayList<>();
        for (Subscription sub : activeSubs) {
            double monthly = toMonthlyPrice(sub.getPrice(), sub.getFrequency());
            double oneYr = round(monthly * 12.0);
            double threeYr = round(monthly * 36.0);
            double fiveYr = round(monthly * 60.0);
            double oppCost = round(monthly * OPPORTUNITY_FACTOR_5YR);

            list.add(AnalyticsResponse.VampireProjection.builder()
                    .subscriptionId(sub.getId())
                    .name(sub.getName())
                    .category(categoryOf(sub).getValue())
                    .monthlyCost(round(monthly))
                    .oneYearSpend(oneYr)
                    .threeYearSpend(threeYr)
                    .fiveYearSpend(fiveYr)
                    .fiveYearOpportunityCost(oppCost)
                    .highDrainRisk(fiveYr >= 600.0)
                    .build());
        }

        list.sort(Comparator.comparingDouble(AnalyticsResponse.VampireProjection::getFiveYearOpportunityCost).reversed());
        return list;
    }

    private List<AnalyticsResponse.CategoryBreakdown> computeCategoryBreakdowns(List<Subscription> activeSubs, double totalMonthlySpend) {
        Map<Category, List<Subscription>> map = activeSubs.stream()
                .collect(Collectors.groupingBy(AnalyticsService::categoryOf));

        List<AnalyticsResponse.CategoryBreakdown> list = new ArrayList<>();
        for (Map.Entry<Category, List<Subscription>> entry : map.entrySet()) {
            double catMonthly = round(entry.getValue().stream()
                    .mapToDouble(s -> toMonthlyPrice(s.getPrice(), s.getFrequency()))
                    .sum());
            double pct = totalMonthlySpend > 0 ? round((catMonthly / totalMonthlySpend) * 100.0) : 0.0;

            list.add(AnalyticsResponse.CategoryBreakdown.builder()
                    .category(entry.getKey())
                    .categoryName(entry.getKey().getValue())
                    .monthlySpend(catMonthly)
                    .percentage(pct)
                    .count(entry.getValue().size())
                    .build());
        }

        list.sort(Comparator.comparingDouble(AnalyticsResponse.CategoryBreakdown::getMonthlySpend).reversed());
        return list;
    }

    private double round(double val) {
        return BigDecimal.valueOf(val).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private record FatigueRating(String level, String color, String interpretation) {}

    private FatigueRating evaluateFatigue(int score) {
        if (score <= 30) {
            return new FatigueRating(
                    "OPTIMAL",
                    "#10b981",
                    "Healthy recurring footprint. Subscriptions are lean with minimal cognitive clutter and negligible functional overlap."
            );
        } else if (score <= 60) {
            return new FatigueRating(
                    "MODERATE",
                    "#f59e0b",
                    "Controlled commitment load. Minor category clusters detected, but financial drain remains manageable."
            );
        } else if (score <= 80) {
            return new FatigueRating(
                    "ELEVATED",
                    "#f97316",
                    "Subscription fatigue emerging. High redundancy in core categories; uncoordinated renewal collisions may cause cash flow pinches."
            );
        } else {
            return new FatigueRating(
                    "BURNOUT",
                    "#ef4444",
                    "Severe subscription saturation. Heavy recurring leakage, multi-service functional duplication, and significant lost opportunity cost."
            );
        }
    }
}
