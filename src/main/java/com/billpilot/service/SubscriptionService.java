package com.billpilot.service;

import com.billpilot.dto.request.CreateSubscriptionRequest;
import com.billpilot.dto.request.UpdateSubscriptionRequest;
import com.billpilot.exception.ForbiddenException;
import com.billpilot.exception.ResourceNotFoundException;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;

    public Subscription createSubscription(CreateSubscriptionRequest request, String userId) {
        Subscription subscription = Subscription.builder()
                .name(request.getName().trim())
                .price(request.getPrice())
                .currency(request.getCurrency() != null ? request.getCurrency() : "USD")
                .frequency(request.getFrequency())
                .category(request.getCategory())
                .paymentMethod(request.getPaymentMethod().trim())
                .status(SubscriptionStatus.ACTIVE)
                .startDate(request.getStartDate())
                .renewalDate(request.getRenewalDate())
                .user(userId)
                .build();

        subscription.calculateRenewalDateIfMissing();

        return subscriptionRepository.save(subscription);
    }

    public List<Subscription> getUserSubscriptions(String targetUserId, User authenticatedUser) {
        if (!authenticatedUser.getId().equals(targetUserId)) {
            throw new ForbiddenException("You are not the owner of the account");
        }

        return subscriptionRepository.findByUser(targetUserId);
    }

    public Subscription getSubscriptionById(String id, User authenticatedUser) {
        Subscription subscription = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));

        if (!subscription.getUser().equals(authenticatedUser.getId())) {
            throw new ForbiddenException("You are not authorized to view this subscription");
        }

        return subscription;
    }

    public Subscription updateSubscription(String id, UpdateSubscriptionRequest request, User authenticatedUser) {
        Subscription subscription = getSubscriptionById(id, authenticatedUser);

        if (request.getName() != null) subscription.setName(request.getName().trim());
        if (request.getPrice() != null) subscription.setPrice(request.getPrice());
        if (request.getCurrency() != null) subscription.setCurrency(request.getCurrency());
        if (request.getFrequency() != null) subscription.setFrequency(request.getFrequency());
        if (request.getCategory() != null) subscription.setCategory(request.getCategory());
        if (request.getPaymentMethod() != null) subscription.setPaymentMethod(request.getPaymentMethod().trim());
        if (request.getStatus() != null) subscription.setStatus(request.getStatus());
        if (request.getStartDate() != null) subscription.setStartDate(request.getStartDate());

        if (request.getRenewalDate() != null) {
            subscription.setRenewalDate(request.getRenewalDate());
        } else if (request.getFrequency() != null || request.getStartDate() != null) {
            subscription.setRenewalDate(null);
            subscription.calculateRenewalDateIfMissing();
        }

        return subscriptionRepository.save(subscription);
    }

    public void deleteSubscription(String id, User authenticatedUser) {
        Subscription subscription = getSubscriptionById(id, authenticatedUser);
        subscriptionRepository.delete(subscription);
    }

    public Subscription cancelSubscription(String id, User authenticatedUser) {
        Subscription subscription = getSubscriptionById(id, authenticatedUser);
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        return subscriptionRepository.save(subscription);
    }

    public List<Subscription> getUpcomingRenewals(User authenticatedUser) {
        LocalDate today = LocalDate.now();
        LocalDate nextWeek = today.plusDays(7);

        return subscriptionRepository.findByUser(authenticatedUser.getId()).stream()
                .filter(sub -> sub.getStatus() == SubscriptionStatus.ACTIVE)
                .filter(sub -> sub.getRenewalDate() != null)
                .filter(sub -> !sub.getRenewalDate().isBefore(today) && !sub.getRenewalDate().isAfter(nextWeek))
                .toList();
    }
}
