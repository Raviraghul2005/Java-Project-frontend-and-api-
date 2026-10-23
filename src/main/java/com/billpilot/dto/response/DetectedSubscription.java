package com.billpilot.dto.response;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
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
public class DetectedSubscription {
    private String name;
    private String merchantKey;
    private Category category;
    private Frequency frequency;
    /** Most recent charge. */
    private double amount;
    private double monthlyAmount;
    private int occurrences;
    private LocalDate firstSeen;
    private LocalDate lastSeen;
    private LocalDate nextExpected;
    /** 0-100. */
    private int confidence;
    /** True when the merchant matched the built-in subscription catalog. */
    private boolean knownMerchant;
    /** Set when the latest charge differs from the one before it. */
    private Double previousAmount;
    private boolean alreadyTracked;
    /** Human-readable explanation of why this was flagged. */
    private String evidence;
    /** Unique per detection: merchantKey#frequency#anchorDay#amount. */
    private String streamId;
    /** Label of the shared biller ("Apple") the charges were found under, null for ordinary merchants. */
    private String sharedDescriptor;
    /** Billing day of the month (for weekly: day of the month of the first charge). */
    private int anchorDay;
    /** How many of its charges were part of a grouped debit. */
    private int groupedCharges;
    /** "active", "overdue" or "stopped". */
    private String status;
    /** Date of the first charge at the current price; null when the price never changed. */
    private LocalDate priceChangedOn;
    /** Name of the tracked subscription this matched, filled by the analysis service. */
    private String trackedName;
    /** Every charge used, oldest first. */
    private List<ChargeRef> charges;

    /** One charge behind a detection; {@code amount} is this subscription's share of the charge. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChargeRef {
        private LocalDate date;
        private double amount;
        private boolean grouped;
    }
}
