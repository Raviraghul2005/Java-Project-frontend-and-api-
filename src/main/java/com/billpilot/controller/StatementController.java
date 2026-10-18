package com.billpilot.controller;

import com.billpilot.dto.response.ApiResponse;
import com.billpilot.dto.response.StatementAnalysisResponse;
import com.billpilot.model.User;
import com.billpilot.service.StatementAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/statements")
@RequiredArgsConstructor
public class StatementController {

    private final StatementAnalysisService statementAnalysisService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<StatementAnalysisResponse>> analyze(
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal User user) {
        StatementAnalysisResponse result = statementAnalysisService.analyze(file, user);
        return ResponseEntity.ok(ApiResponse.<StatementAnalysisResponse>builder()
                .success(true)
                .message("Scanned " + result.getTransactionsScanned() + " transactions")
                .data(result)
                .build());
    }
}
