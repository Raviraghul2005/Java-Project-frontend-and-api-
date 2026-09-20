package com.billpilot.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Category {
    SPORTS("sports"),
    NEWS("news"),
    ENTERTAINMENT("entertainment"),
    LIFESTYLE("lifestyle"),
    TECHNOLOGY("technology"),
    FINANCE("finance"),
    POLITICS("politics"),
    OTHER("other");

    private final String value;

    Category(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static Category fromValue(String value) {
        if (value == null) return null;
        for (Category cat : Category.values()) {
            if (cat.value.equalsIgnoreCase(value)) {
                return cat;
            }
        }
        throw new IllegalArgumentException("Unknown category: " + value);
    }
}
