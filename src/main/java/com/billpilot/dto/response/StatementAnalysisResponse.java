package com.billpilot.dto.response;

import com.billpilot.statement.SharedDescriptorSummary;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatementAnalysisResponse {
    private int transactionsScanned;
    private List<DetectedSubscription> detected;
    private int untrackedCount;
    private double detectedMonthlyTotal;
    private double untrackedMonthlyTotal;
    /** One entry per shared descriptor (Apple, PayPal, ...) found on the statement. */
    private List<SharedDescriptorSummary> sharedDescriptors;
}
