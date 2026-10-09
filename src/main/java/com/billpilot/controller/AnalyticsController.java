package com.billpilot.controller;

import com.billpilot.dto.response.AnalyticsResponse;
import com.billpilot.dto.response.ApiResponse;
import com.billpilot.model.User;
import com.billpilot.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<AnalyticsResponse>> getAnalyticsAudit(@AuthenticationPrincipal User user) {
        AnalyticsResponse response = analyticsService.computeAnalyticsAudit(user);
        return ResponseEntity.ok(ApiResponse.<AnalyticsResponse>builder()
                .success(true)
                .data(response)
                .build());
    }
}
