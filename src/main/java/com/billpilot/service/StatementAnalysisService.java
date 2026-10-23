package com.billpilot.service;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.dto.response.StatementAnalysisResponse;
import com.billpilot.exception.BadRequestException;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.statement.Detection;
import com.billpilot.statement.MerchantNormalizer;
import com.billpilot.statement.RecurringDetector;
import com.billpilot.statement.StatementParser;
import com.billpilot.statement.Transaction;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Parses an uploaded statement in memory and reports recurring charges. The file is never stored. */
@Service
@RequiredArgsConstructor
public class StatementAnalysisService {

    private final StatementParser parser;
    private final RecurringDetector detector;
    private final SubscriptionRepository subscriptionRepository;

    /** How far a tracked renewal day may sit from a stream's billing day. */
    private static final int DAY_TOLERANCE = 3;

    public StatementAnalysisResponse analyze(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Please choose a CSV file to upload.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (!name.endsWith(".csv")) {
            throw new BadRequestException("Only .csv statements are supported.");
        }

        List<Transaction> transactions;
        try (InputStream in = file.getInputStream()) {
            transactions = parser.parse(in);
        } catch (IOException e) {
            throw new BadRequestException("Could not read the uploaded file.");
        }

        Detection detection = detector.detectDetailed(transactions);
        List<DetectedSubscription> detected = detection.detected();

        List<Subscription> active = subscriptionRepository.findByUser(user.getId()).stream()
                .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE)
                .toList();
        Set<String> tracked = active.stream()
                .map(Subscription::getName)
                .map(MerchantNormalizer::key)
                .collect(Collectors.toSet());
        detected.forEach(d -> d.setAlreadyTracked(d.getSharedDescriptor() == null && tracked.contains(d.getMerchantKey())));
        matchSharedStreams(detected, active);

        // A stopped subscription no longer costs anything, so it stays out of the totals.
        List<DetectedSubscription> running = detected.stream().filter(d -> !"stopped".equals(d.getStatus())).toList();
        double total = round(running.stream().mapToDouble(DetectedSubscription::getMonthlyAmount).sum());
        List<DetectedSubscription> untracked = running.stream().filter(d -> !d.isAlreadyTracked()).toList();
        double untrackedTotal = round(untracked.stream().mapToDouble(DetectedSubscription::getMonthlyAmount).sum());

        return StatementAnalysisResponse.builder()
                .transactionsScanned(transactions.size())
                .detected(detected)
                .untrackedCount(untracked.size())
                .detectedMonthlyTotal(total)
                .untrackedMonthlyTotal(untrackedTotal)
                .sharedDescriptors(detection.sharedDescriptors())
                .build();
    }

    /**
     * A stream found under a shared descriptor has no merchant name to compare, so it is matched to a tracked
     * subscription by frequency, price and billing day. Each tracked subscription matches at most one stream,
     * the closest billing day first.
     */
    private static void matchSharedStreams(List<DetectedSubscription> detected, List<Subscription> active) {
        record Pair(DetectedSubscription stream, Subscription sub, int distance) {
        }
        List<Pair> pairs = new ArrayList<>();
        for (DetectedSubscription d : detected) {
            if (d.getSharedDescriptor() == null) continue;
            for (Subscription s : active) {
                if (s.getRenewalDate() == null || s.getPrice() == null || s.getFrequency() != d.getFrequency()) continue;
                if (Math.abs(s.getPrice() - d.getAmount()) > Math.max(0.01, d.getAmount() * 0.005)) continue;
                int distance = dayDistance(s.getRenewalDate().getDayOfMonth(), d.getAnchorDay());
                if (distance <= DAY_TOLERANCE) pairs.add(new Pair(d, s, distance));
            }
        }
        pairs.sort(Comparator.comparingInt(Pair::distance));
        // identity, not equals(): two streams or two subscriptions with equal fields are still different ones
        Set<Object> taken = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Pair p : pairs) {
            if (taken.contains(p.stream()) || taken.contains(p.sub())) continue;
            taken.add(p.stream());
            taken.add(p.sub());
            p.stream().setAlreadyTracked(true);
            p.stream().setTrackedName(p.sub().getName());
        }
    }

    /** Days between two days of the month, counting 31 and 1 as neighbours. */
    static int dayDistance(int a, int b) {
        int d = Math.abs(a - b);
        return Math.min(d, 31 - d);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
