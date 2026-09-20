package com.billpilot.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum SubscriptionStatus {
    ACTIVE("active"),
    CANCELLED("cancelled"),
    EXPIRED("expired");

    private final String value;

    SubscriptionStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static SubscriptionStatus fromValue(String value) {
        if (value == null) return null;
        for (SubscriptionStatus status : SubscriptionStatus.values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown status: " + value);
    }
}
