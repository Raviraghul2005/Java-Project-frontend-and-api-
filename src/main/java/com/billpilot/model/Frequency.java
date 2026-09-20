package com.billpilot.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Frequency {
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly"),
    YEARLY("yearly");

    private final String value;

    Frequency(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static Frequency fromValue(String value) {
        if (value == null) return null;
        for (Frequency freq : Frequency.values()) {
            if (freq.value.equalsIgnoreCase(value)) {
                return freq;
            }
        }
        throw new IllegalArgumentException("Unknown frequency: " + value);
    }
}
