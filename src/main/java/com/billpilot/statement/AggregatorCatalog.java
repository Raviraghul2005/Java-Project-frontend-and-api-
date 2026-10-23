package com.billpilot.statement;

import java.util.List;
import java.util.Optional;

/**
 * Descriptors that many subscriptions are billed under (app stores, wallets, marketplaces, payment
 * gateways). Matching runs on the normalized statement text, like {@link MerchantCatalog}.
 * {@code groupsPurchases} is true when the biller may add several purchases into one debit.
 */
public final class AggregatorCatalog {

    public record Aggregator(String key, String label, boolean groupsPurchases, List<String> keywords) {
    }

    private static final List<Aggregator> AGGREGATORS = List.of(
            new Aggregator("apple", "Apple", true, List.of("apple", "itunes", "apple services", "apple media")),
            new Aggregator("google play", "Google Play", false, List.of("google play", "googleplay", "play store")),
            new Aggregator("paypal", "PayPal", false, List.of("paypal")),
            new Aggregator("amazon", "Amazon", false, List.of("amzn mktp", "amazon mktplace", "amazon")),
            new Aggregator("paddle", "Paddle", false, List.of("paddle")),
            new Aggregator("razorpay", "Razorpay", false, List.of("razorpay")),
            new Aggregator("payu", "PayU", false, List.of("payu")),
            new Aggregator("billdesk", "BillDesk", false, List.of("billdesk"))
    );

    private AggregatorCatalog() {
    }

    public static Optional<Aggregator> find(String normalizedText) {
        if (normalizedText == null || normalizedText.isBlank()) return Optional.empty();
        String padded = " " + normalizedText + " ";
        // Longest keyword wins, same as MerchantCatalog.
        Aggregator best = null;
        int bestLen = 0;
        for (Aggregator a : AGGREGATORS) {
            for (String k : a.keywords()) {
                if (k.length() > bestLen && padded.contains(" " + k + " ")) {
                    best = a;
                    bestLen = k.length();
                }
            }
        }
        return Optional.ofNullable(best);
    }
}
