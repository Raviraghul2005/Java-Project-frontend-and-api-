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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderSchedulerService {

    static final List<Integer> REMINDER_DAYS = List.of(7, 5, 2, 1);

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    /**
     * Daily scheduled check running at 9:00 AM every morning (server time unless
     * {@code app.scheduler.zone} is set). Rolls renewed subscriptions forward and
     * sends reminder emails for upcoming renewals.
     */
    @Scheduled(cron = "${app.scheduler.reminder-cron:0 0 9 * * *}", zone = "${app.scheduler.zone:}")
    public void scheduleDailyRenewalReminders() {
        log.info("Running daily scheduled renewal reminder check...");
        processUpcomingReminders();
    }

    /** Returns the number of reminder emails dispatched. */
    public int processUpcomingReminders() {
        LocalDate today = LocalDate.now();

        rollOverdueSubscriptionsForward(today);

        // Only fetch subscriptions that renew on a reminder day instead of scanning every active one.
        List<Subscription> due = new ArrayList<>();
        Map<String, Integer> daysLeftBySubscription = new HashMap<>();
        for (int days : REMINDER_DAYS) {
            for (Subscription sub : subscriptionRepository.findByStatusAndRenewalDate(SubscriptionStatus.ACTIVE, today.plusDays(days))) {
                if (!alreadySent(sub, days)) {
                    due.add(sub);
                    daysLeftBySubscription.put(sub.getId(), days);
                }
            }
        }

        Set<String> userIds = due.stream().map(Subscription::getUser).collect(Collectors.toSet());
        Map<String, User> usersById = StreamSupport.stream(userRepository.findAllById(userIds).spliterator(), false)
                .collect(Collectors.toMap(User::getId, u -> u));

        List<Subscription> notified = new ArrayList<>();
        for (Subscription sub : due) {
            User user = usersById.get(sub.getUser());
            if (user == null) continue;

            int daysLeft = daysLeftBySubscription.get(sub.getId());
            emailService.sendRenewalReminderEmail(sub, user, daysLeft);
            markSent(sub, daysLeft);
            notified.add(sub);
        }
        subscriptionRepository.saveAll(notified);

        log.info("Processed upcoming reminders: {} emails dispatched", notified.size());
        return notified.size();
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

        int daysLeft = (int) ChronoUnit.DAYS.between(LocalDate.now(), subscription.getRenewalDate());

        if (REMINDER_DAYS.contains(daysLeft) && !alreadySent(subscription, daysLeft)) {
            User user = userRepository.findById(subscription.getUser()).orElse(null);
            if (user != null) {
                emailService.sendRenewalReminderEmail(subscription, user, daysLeft);
                markSent(subscription, daysLeft);
                subscriptionRepository.save(subscription);
                return true;
            }
        }

        return false;
    }

    /** Active subscriptions keep renewing: advance a passed billing date to the next one. */
    private void rollOverdueSubscriptionsForward(LocalDate today) {
        List<Subscription> overdue = subscriptionRepository.findByStatusAndRenewalDateBefore(SubscriptionStatus.ACTIVE, today);
        if (overdue.isEmpty()) return;

        overdue.forEach(sub -> sub.rollRenewalDateForward(today));
        subscriptionRepository.saveAll(overdue);
        log.info("Rolled {} subscriptions forward to their next renewal date", overdue.size());
    }

    private boolean alreadySent(Subscription sub, int daysLeft) {
        return Objects.equals(sub.getLastReminderRenewalDate(), sub.getRenewalDate())
                && Objects.equals(sub.getLastReminderDaysLeft(), daysLeft);
    }

    private void markSent(Subscription sub, int daysLeft) {
        sub.setLastReminderRenewalDate(sub.getRenewalDate());
        sub.setLastReminderDaysLeft(daysLeft);
    }
}
