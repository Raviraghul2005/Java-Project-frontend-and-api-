package com.billpilot.dto.response;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

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
}
