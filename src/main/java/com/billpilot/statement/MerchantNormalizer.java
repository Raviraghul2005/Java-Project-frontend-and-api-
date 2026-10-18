package com.billpilot.statement;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Turns raw statement descriptions ("NETFLIX.COM 8007 CA", "UPI-NETFLIX-123@ybl")
 * into a stable grouping key ("netflix").
 */
public final class MerchantNormalizer {

    private static final Set<String> NOISE = Set.of(
            "upi", "pos", "ach", "ecs", "nach", "imps", "neft", "debit", "card", "purchase", "payment", "pmt",
            "recurring", "autopay", "auto", "pay", "bill", "billing", "subscription", "sub", "mandate", "si",
            "com", "www", "net", "org", "in", "co", "pvt", "ltd", "inc", "llc", "limited", "private", "tech",
            "india", "ca", "us", "usa", "uk", "ybl", "okaxis", "oksbi", "okhdfcbank", "paytm", "ibl", "axl",
            "http", "https", "ref", "txn", "id", "to", "the", "of", "and", "visa", "mastercard", "intl", "intern"
    );

    private MerchantNormalizer() {
    }

    /** Lowercase letters and single spaces only; digits, symbols and noise words removed. */
    public static String clean(String description) {
        if (description == null) return "";
        String letters = description.toLowerCase().replace("+", " plus ").replaceAll("[^a-z0-9]+", " ");
        // Drop standalone numbers (card suffixes, reference ids) but keep names like "1password".
        letters = letters.replaceAll("\\b\\d+\\b", " ");
        // Branch/store suffixes glued to a name ("FIT24", "STORE1182") are not part of the merchant.
        letters = letters.replaceAll("(?<=[a-z])\\d+\\b", "");
        return Arrays.stream(letters.trim().split("\\s+"))
                .filter(t -> !t.isBlank() && !NOISE.contains(t))
                .collect(Collectors.joining(" "));
    }

    /**
     * Grouping key for a description. Known merchants collapse to their catalog name,
     * unknown ones to the first two meaningful tokens.
     */
    public static String key(String description) {
        String cleaned = clean(description);
        if (cleaned.isEmpty()) return "";
        return MerchantCatalog.find(cleaned)
                .map(m -> m.name().toLowerCase())
                .orElseGet(() -> Arrays.stream(cleaned.split(" ")).limit(2).collect(Collectors.joining(" ")));
    }
}
