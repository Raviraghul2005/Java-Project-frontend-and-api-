package com.billpilot.dto.response;

import com.billpilot.model.Category;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsResponse {

    private double totalMonthlySpend;
    private double totalAnnualSpend;
    private int activeCount;

    // All figures are in this currency; subscriptions billed in other currencies are left out.
    private String currency;
    private List<String> excludedCurrencies;
    private int excludedSubscriptionCount;

    // Subscription Fatigue Index (0 - 100)
    private int fatigueIndex;
    private String fatigueLevel; // "OPTIMAL", "MODERATE", "ELEVATED", "BURNOUT"
    private String fatigueColor; // "#10b981", "#f59e0b", "#f97316", "#ef4444"
    private String fatigueInterpretation;

    // Functional Redundancy Matrix
    private int redundancyCount;
    private double potentialAnnualSavings;
    private List<RedundancyGroup> redundancies;

    // Vampire Drain & Opportunity Cost Projections
    private double total5YearOpportunityCost;
    private List<VampireProjection> vampireProjections;

    // Renewal Collision Timeline (Next 30 Days)
    private List<RenewalCollision> collisionTimeline;

    // Category Breakdown
    private List<CategoryBreakdown> categoryBreakdowns;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RedundancyGroup {
        private String category;
        private String title;
        private List<String> serviceNames;
        private double monthlySpend;
        private double annualSpend;
        private double potentialAnnualSavings;
        private String recommendation;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VampireProjection {
        private String subscriptionId;
        private String name;
        private String category;
        private double monthlyCost;
        private double oneYearSpend;
        private double threeYearSpend;
        private double fiveYearSpend;
        private double fiveYearOpportunityCost; // At 7% compound interest
        private boolean highDrainRisk;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RenewalCollision {
        private LocalDate date;
        private int count;
        private double totalCost;
        private List<String> serviceNames;
        private boolean collisionRisk; // true if >= 2 renewals or cost > $40
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryBreakdown {
        private Category category;
        private String categoryName;
        private double monthlySpend;
        private double percentage;
        private int count;
    }
}
