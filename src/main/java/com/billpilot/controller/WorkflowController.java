package com.billpilot.controller;

import com.billpilot.dto.request.WorkflowReminderRequest;
import com.billpilot.dto.response.ApiResponse;
import com.billpilot.exception.UnauthorizedException;
import com.billpilot.service.ReminderSchedulerService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Webhook for external schedulers/automation. This route is not covered by the JWT filter, so it
 * authenticates callers with a shared secret in the {@code X-Workflow-Token} header. When
 * {@code app.workflow.token} is not configured the endpoint is disabled.
 */
@RestController
@RequestMapping("/api/v1/workflows")
public class WorkflowController {

    static final String TOKEN_HEADER = "X-Workflow-Token";

    private final ReminderSchedulerService reminderSchedulerService;
    private final String workflowToken;

    public WorkflowController(
            ReminderSchedulerService reminderSchedulerService,
            @Value("${app.workflow.token:}") String workflowToken) {
        this.reminderSchedulerService = reminderSchedulerService;
        this.workflowToken = workflowToken;
    }

    @PostMapping("/subscription/reminder")
    public ResponseEntity<ApiResponse<Void>> triggerReminder(
            @RequestHeader(value = TOKEN_HEADER, required = false) String providedToken,
            @Valid @RequestBody WorkflowReminderRequest request) {
        requireValidToken(providedToken);

        boolean processed = reminderSchedulerService.processSingleSubscriptionReminder(request.getSubscriptionId());
        String message = processed ? "Reminder evaluated and sent" : "No reminder due or invalid subscription";
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .success(true)
                .message(message)
                .build());
    }

    private void requireValidToken(String providedToken) {
        if (workflowToken == null || workflowToken.isBlank()
                || providedToken == null
                || !MessageDigest.isEqual(
                        workflowToken.getBytes(StandardCharsets.UTF_8),
                        providedToken.getBytes(StandardCharsets.UTF_8))) {
            throw new UnauthorizedException("Unauthorized");
        }
    }
}
