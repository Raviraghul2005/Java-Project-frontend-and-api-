package com.billpilot.service;

import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderSchedulerService {

    private static final Set<Integer> REMINDER_DAYS = Set.of(7, 5, 2, 1);

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    /**
     * Daily scheduled check running at 9:00 AM every morning.
     * Evaluates active subscriptions and triggers reminder emails.
     */
    @Scheduled(cron = "${app.scheduler.reminder-cron:0 0 9 * * *}")
    public void scheduleDailyRenewalReminders() {
        log.info("Running daily scheduled renewal reminder check...");
        processUpcomingReminders();
    }

    public int processUpcomingReminders() {
        LocalDate today = LocalDate.now();
        List<Subscription> activeSubscriptions = subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE);
        int sentCount = 0;

        for (Subscription sub : activeSubscriptions) {
            if (sub.getRenewalDate() == null) continue;

            long daysBetween = ChronoUnit.DAYS.between(today, sub.getRenewalDate());
            int daysLeft = (int) daysBetween;

            if (REMINDER_DAYS.contains(daysLeft)) {
                User user = userRepository.findById(sub.getUser()).orElse(null);
                if (user != null) {
                    emailService.sendRenewalReminderEmail(sub, user, daysLeft);
                    sentCount++;
                }
            } else if (daysBetween < 0) {
                // Auto expire past subscriptions
                sub.setStatus(SubscriptionStatus.EXPIRED);
                subscriptionRepository.save(sub);
            }
        }

        log.info("Processed upcoming reminders: {} emails dispatched", sentCount);
        return sentCount;
    }

    /**
     * Evaluates a single subscription by ID (used by the workflow webhook endpoint).
     */
    public boolean processSingleSubscriptionReminder(String subscriptionId) {
        Subscription subscription = subscriptionRepository.findById(subscriptionId).orElse(null);
        if (subscription == null || subscription.getStatus() != SubscriptionStatus.ACTIVE) {
            log.warn("Subscription {} not found or not active", subscriptionId);
            return false;
        }

        if (subscription.getRenewalDate() == null) return false;

        long daysBetween = ChronoUnit.DAYS.between(LocalDate.now(), subscription.getRenewalDate());
        int daysLeft = (int) daysBetween;

        if (REMINDER_DAYS.contains(daysLeft)) {
            User user = userRepository.findById(subscription.getUser()).orElse(null);
            if (user != null) {
                emailService.sendRenewalReminderEmail(subscription, user, daysLeft);
                return true;
            }
        }

        return false;
    }
}
