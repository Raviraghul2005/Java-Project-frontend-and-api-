package com.billpilot.controller;

import com.billpilot.dto.request.CreateSubscriptionRequest;
import com.billpilot.dto.request.UpdateSubscriptionRequest;
import com.billpilot.dto.response.ApiResponse;
import com.billpilot.model.Subscription;
import com.billpilot.model.User;
import com.billpilot.service.SubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/subscriptions")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    @PostMapping
    public ResponseEntity<ApiResponse<Subscription>> createSubscription(
            @Valid @RequestBody CreateSubscriptionRequest request,
            @AuthenticationPrincipal User user) {
        Subscription subscription = subscriptionService.createSubscription(request, user.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<Subscription>builder()
                        .success(true)
                        .data(subscription)
                        .build());
    }

    @GetMapping("/user/{id}")
    public ResponseEntity<ApiResponse<List<Subscription>>> getUserSubscriptions(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        List<Subscription> subscriptions = subscriptionService.getUserSubscriptions(id, user);
        return ResponseEntity.ok(ApiResponse.<List<Subscription>>builder()
                .success(true)
                .data(subscriptions)
                .build());
    }

    @GetMapping("/upcoming-renewals")
    public ResponseEntity<ApiResponse<List<Subscription>>> getUpcomingRenewals(
            @AuthenticationPrincipal User user) {
        List<Subscription> subscriptions = subscriptionService.getUpcomingRenewals(user);
        return ResponseEntity.ok(ApiResponse.<List<Subscription>>builder()
                .success(true)
                .data(subscriptions)
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Subscription>> getSubscriptionById(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        Subscription subscription = subscriptionService.getSubscriptionById(id, user);
        return ResponseEntity.ok(ApiResponse.<Subscription>builder()
                .success(true)
                .data(subscription)
                .build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Subscription>> updateSubscription(
            @PathVariable String id,
            @Valid @RequestBody UpdateSubscriptionRequest request,
            @AuthenticationPrincipal User user) {
        Subscription updated = subscriptionService.updateSubscription(id, request, user);
        return ResponseEntity.ok(ApiResponse.<Subscription>builder()
                .success(true)
                .data(updated)
                .build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSubscription(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        subscriptionService.deleteSubscription(id, user);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .success(true)
                .message("Subscription deleted successfully")
                .build());
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<Subscription>> cancelSubscription(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        Subscription cancelled = subscriptionService.cancelSubscription(id, user);
        return ResponseEntity.ok(ApiResponse.<Subscription>builder()
                .success(true)
                .data(cancelled)
                .build());
    }
}
