package com.billpilot.service;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.dto.response.StatementAnalysisResponse;
import com.billpilot.exception.BadRequestException;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.statement.MerchantNormalizer;
import com.billpilot.statement.RecurringDetector;
import com.billpilot.statement.StatementParser;
import com.billpilot.statement.Transaction;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
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

        List<DetectedSubscription> detected = detector.detect(transactions);

        Set<String> tracked = subscriptionRepository.findByUser(user.getId()).stream()
                .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE)
                .map(Subscription::getName)
                .map(MerchantNormalizer::key)
                .collect(Collectors.toSet());
        detected.forEach(d -> d.setAlreadyTracked(tracked.contains(d.getMerchantKey())));

        double total = round(detected.stream().mapToDouble(DetectedSubscription::getMonthlyAmount).sum());
        List<DetectedSubscription> untracked = detected.stream().filter(d -> !d.isAlreadyTracked()).toList();
        double untrackedTotal = round(untracked.stream().mapToDouble(DetectedSubscription::getMonthlyAmount).sum());

        return StatementAnalysisResponse.builder()
                .transactionsScanned(transactions.size())
                .detected(detected)
                .untrackedCount(untracked.size())
                .detectedMonthlyTotal(total)
                .untrackedMonthlyTotal(untrackedTotal)
                .build();
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
