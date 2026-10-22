package com.billpilot.service;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ReminderSchedulerServiceTest {

    private SubscriptionRepository subscriptionRepository;
    private UserRepository userRepository;
    private EmailService emailService;
    private ReminderSchedulerService scheduler;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        subscriptionRepository = mock(SubscriptionRepository.class);
        userRepository = mock(UserRepository.class);
        emailService = mock(EmailService.class);
        scheduler = new ReminderSchedulerService(subscriptionRepository, userRepository, emailService);
        today = LocalDate.now();

        when(subscriptionRepository.findByStatusAndRenewalDateBefore(any(), any())).thenReturn(List.of());
        when(subscriptionRepository.findByStatusAndRenewalDate(any(), any())).thenReturn(List.of());
    }

    private Subscription sub(String id, LocalDate renewal) {
        return Subscription.builder().id(id).name("Netflix").price(10.0).currency("USD")
                .frequency(Frequency.MONTHLY).category(Category.ENTERTAINMENT).paymentMethod("Card")
                .status(SubscriptionStatus.ACTIVE).startDate(renewal.minusMonths(1)).renewalDate(renewal)
                .user("u1").build();
    }

    @Test
    void overdueActiveSubscriptionsAreRolledForwardNotExpired() {
        Subscription overdue = sub("s1", today.minusDays(3));
        when(subscriptionRepository.findByStatusAndRenewalDateBefore(SubscriptionStatus.ACTIVE, today)).thenReturn(List.of(overdue));

        scheduler.processUpcomingReminders();

        assertEquals(SubscriptionStatus.ACTIVE, overdue.getStatus());
        assertFalse(overdue.getRenewalDate().isBefore(today));
        verify(subscriptionRepository).saveAll(List.of(overdue));
    }

    @Test
    void sendsReminderOnceForSevenDayThreshold() {
        Subscription due = sub("s1", today.plusDays(7));
        User user = User.builder().id("u1").email("u1@example.com").name("U").build();
        when(subscriptionRepository.findByStatusAndRenewalDate(SubscriptionStatus.ACTIVE, today.plusDays(7))).thenReturn(List.of(due));
        when(userRepository.findAllById(any())).thenReturn(List.of(user));

        assertEquals(1, scheduler.processUpcomingReminders());
        verify(emailService).sendRenewalReminderEmail(due, user, 7);

        // A second run on the same day must not email again.
        assertEquals(0, scheduler.processUpcomingReminders());
        verify(emailService, times(1)).sendRenewalReminderEmail(any(), any(), anyInt());
    }

    @Test
    void skipsSubscriptionsWhoseOwnerNoLongerExists() {
        Subscription due = sub("s1", today.plusDays(2));
        when(subscriptionRepository.findByStatusAndRenewalDate(SubscriptionStatus.ACTIVE, today.plusDays(2))).thenReturn(List.of(due));
        when(userRepository.findAllById(any())).thenReturn(List.of());

        assertEquals(0, scheduler.processUpcomingReminders());
        verifyNoInteractions(emailService);
    }

    @Test
    void webhookPathDoesNotDoubleSend() {
        Subscription due = sub("s1", today.plusDays(5));
        User user = User.builder().id("u1").email("u1@example.com").name("U").build();
        when(subscriptionRepository.findById("s1")).thenReturn(Optional.of(due));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));

        assertTrue(scheduler.processSingleSubscriptionReminder("s1"));
        assertFalse(scheduler.processSingleSubscriptionReminder("s1"));
        verify(emailService, times(1)).sendRenewalReminderEmail(eq(due), eq(user), eq(5));
    }

    @Test
    void webhookIgnoresNonReminderDaysAndInactiveSubscriptions() {
        Subscription notDue = sub("s1", today.plusDays(4));
        Subscription cancelled = sub("s2", today.plusDays(7));
        cancelled.setStatus(SubscriptionStatus.CANCELLED);
        when(subscriptionRepository.findById("s1")).thenReturn(Optional.of(notDue));
        when(subscriptionRepository.findById("s2")).thenReturn(Optional.of(cancelled));
        when(subscriptionRepository.findById("missing")).thenReturn(Optional.empty());

        assertFalse(scheduler.processSingleSubscriptionReminder("s1"));
        assertFalse(scheduler.processSingleSubscriptionReminder("s2"));
        assertFalse(scheduler.processSingleSubscriptionReminder("missing"));
        verifyNoInteractions(emailService);
    }
}
