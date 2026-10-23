package com.billpilot.statement;

import com.billpilot.dto.response.DetectedSubscription;

import java.util.List;

/** Result of scanning a statement: the detected subscriptions plus a summary per shared descriptor. */
public record Detection(List<DetectedSubscription> detected, List<SharedDescriptorSummary> sharedDescriptors) {
}
