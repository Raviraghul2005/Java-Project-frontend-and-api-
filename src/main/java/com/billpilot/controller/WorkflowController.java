package com.billpilot.controller;

import com.billpilot.dto.request.WorkflowReminderRequest;
import com.billpilot.dto.response.ApiResponse;
import com.billpilot.service.ReminderSchedulerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final ReminderSchedulerService reminderSchedulerService;

    @PostMapping("/subscription/reminder")
    public ResponseEntity<ApiResponse<Void>> triggerReminder(
            @Valid @RequestBody WorkflowReminderRequest request) {
        boolean processed = reminderSchedulerService.processSingleSubscriptionReminder(request.getSubscriptionId());
        String message = processed ? "Reminder evaluated and sent" : "No reminder due or invalid subscription";
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .success(true)
                .message(message)
                .build());
    }
}
