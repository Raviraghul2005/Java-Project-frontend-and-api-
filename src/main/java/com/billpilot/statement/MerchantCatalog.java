package com.billpilot.statement;

import com.billpilot.model.Category;

import java.util.List;
import java.util.Optional;

/**
 * Known subscription merchants. Matching runs on the normalized statement text
 * (lowercase letters and single spaces), so keywords are written the same way.
 */
public final class MerchantCatalog {

    public record Merchant(String name, Category category, List<String> keywords) {
    }

    private static final List<Merchant> MERCHANTS = List.of(
            new Merchant("Netflix", Category.ENTERTAINMENT, List.of("netflix")),
            new Merchant("Spotify", Category.ENTERTAINMENT, List.of("spotify")),
            new Merchant("Disney+", Category.ENTERTAINMENT, List.of("disney plus", "disneyplus", "disney", "hotstar")),
            new Merchant("HBO Max", Category.ENTERTAINMENT, List.of("hbo max", "hbomax")),
            new Merchant("Prime Video", Category.ENTERTAINMENT, List.of("prime video", "primevideo", "amazon prime", "amzn prime")),
            new Merchant("YouTube Premium", Category.ENTERTAINMENT, List.of("youtube premium", "youtubepremium", "google youtube", "youtube")),
            new Merchant("Hulu", Category.ENTERTAINMENT, List.of("hulu")),
            new Merchant("Twitch", Category.ENTERTAINMENT, List.of("twitch")),
            new Merchant("Xbox", Category.ENTERTAINMENT, List.of("xbox")),
            new Merchant("Patreon", Category.ENTERTAINMENT, List.of("patreon")),
            new Merchant("Discord Nitro", Category.ENTERTAINMENT, List.of("discord")),
            new Merchant("Claude Pro", Category.TECHNOLOGY, List.of("anthropic", "claude ai", "claude")),
            new Merchant("ChatGPT Plus", Category.TECHNOLOGY, List.of("openai", "chatgpt")),
            new Merchant("GitHub Copilot", Category.TECHNOLOGY, List.of("github")),
            new Merchant("Notion", Category.TECHNOLOGY, List.of("notion")),
            new Merchant("Figma", Category.TECHNOLOGY, List.of("figma")),
            new Merchant("Canva", Category.TECHNOLOGY, List.of("canva")),
            new Merchant("Adobe Creative Cloud", Category.TECHNOLOGY, List.of("adobe")),
            new Merchant("Dropbox", Category.TECHNOLOGY, List.of("dropbox")),
            new Merchant("Slack", Category.TECHNOLOGY, List.of("slack")),
            new Merchant("Zoom", Category.TECHNOLOGY, List.of("zoom")),
            new Merchant("Microsoft 365", Category.TECHNOLOGY, List.of("microsoft 365", "office 365", "microsoft")),
            new Merchant("1Password", Category.TECHNOLOGY, List.of("1password")),
            new Merchant("Grammarly", Category.TECHNOLOGY, List.of("grammarly")),
            new Merchant("iCloud", Category.TECHNOLOGY, List.of("icloud", "apple com bill")),
            new Merchant("Duolingo", Category.LIFESTYLE, List.of("duolingo")),
            new Merchant("Coursera", Category.LIFESTYLE, List.of("coursera")),
            new Merchant("Medium", Category.NEWS, List.of("medium")),
            new Merchant("LinkedIn Premium", Category.FINANCE, List.of("linkedin"))
    );

    private MerchantCatalog() {
    }

    public static Optional<Merchant> find(String normalizedText) {
        if (normalizedText == null || normalizedText.isBlank()) return Optional.empty();
        String padded = " " + normalizedText + " ";
        // Longest keyword wins so "disney plus" beats a shorter overlapping keyword.
        Merchant best = null;
        int bestLen = 0;
        for (Merchant m : MERCHANTS) {
            for (String k : m.keywords()) {
                if (k.length() > bestLen && padded.contains(" " + k + " ")) {
                    best = m;
                    bestLen = k.length();
                }
            }
        }
        return Optional.ofNullable(best);
    }
}
