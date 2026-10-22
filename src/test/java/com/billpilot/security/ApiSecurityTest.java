package com.billpilot.security;

import com.billpilot.config.SecurityConfig;
import com.billpilot.controller.AnalyticsController;
import com.billpilot.controller.AuthController;
import com.billpilot.controller.StatementController;
import com.billpilot.controller.SubscriptionController;
import com.billpilot.controller.UserController;
import com.billpilot.controller.WorkflowController;
import com.billpilot.filter.RateLimitFilter;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.repository.UserRepository;
import com.billpilot.service.AnalyticsService;
import com.billpilot.service.AuthService;
import com.billpilot.service.ReminderSchedulerService;
import com.billpilot.service.StatementAnalysisService;
import com.billpilot.statement.RecurringDetector;
import com.billpilot.statement.StatementParser;
import com.billpilot.service.SubscriptionService;
import com.billpilot.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * HTTP-level authorization matrix: real security filter chain, JWT filter, rate limiter, exception
 * handler and the user/auth services, with only the persistence layer mocked.
 */
@WebMvcTest(controllers = {
        UserController.class, WorkflowController.class, AuthController.class,
        SubscriptionController.class, AnalyticsController.class, StatementController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class, RateLimitFilter.class,
        UserService.class, AuthService.class,
        StatementAnalysisService.class, StatementParser.class, RecurringDetector.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-that-is-definitely-32-bytes-long!",
        "app.jwt.expiration-ms=3600000",
        "app.workflow.token=correct-workflow-token",
        "app.cors.allowed-origins=http://localhost:3000"
})
class ApiSecurityTest {

    private static final String ALICE_ID = "64f000000000000000000001";
    private static final String BOB_ID = "64f000000000000000000002";

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockitoBean private UserRepository userRepository;
    @MockitoBean private SubscriptionRepository subscriptionRepository;
    @MockitoBean private SubscriptionService subscriptionService;
    @MockitoBean private AnalyticsService analyticsService;
    @MockitoBean private ReminderSchedulerService reminderSchedulerService;

    private String aliceToken;

    @BeforeEach
    void setUp() {
        User alice = User.builder().id(ALICE_ID).name("Alice").email("alice@example.com")
                .password(passwordEncoder.encode("alice-password")).build();
        when(userRepository.findById(ALICE_ID)).thenReturn(Optional.of(alice));
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(alice));
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());
        when(userRepository.existsById(anyString())).thenReturn(true);
        aliceToken = "Bearer " + jwtService.generateToken(ALICE_ID);
    }

    // ---- authentication -------------------------------------------------------------------

    @Test
    void protectedRoutesRejectMissingToken() throws Exception {
        mvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/subscriptions/upcoming-renewals")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/analytics/audit")).andExpect(status().isUnauthorized());
    }

    @Test
    void forgedTokenSignedWithAnotherKeyIsRejected() throws Exception {
        String forged = new JwtService("a-completely-different-secret-of-32+chars!!", 3_600_000).generateToken(ALICE_ID);
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void garbageTokenIsRejected() throws Exception {
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized());
    }

    // ---- user endpoints (previously: any user could list / read / delete every user) ----------

    @Test
    void userCanReadOwnProfile() throws Exception {
        mvc.perform(get("/api/v1/users/me").header("Authorization", aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("alice@example.com"))
                .andExpect(jsonPath("$.data.password").doesNotExist());
    }

    @Test
    void userCannotReadAnotherUser() throws Exception {
        mvc.perform(get("/api/v1/users/" + BOB_ID).header("Authorization", aliceToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void userCannotDeleteAnotherUser() throws Exception {
        mvc.perform(delete("/api/v1/users/" + BOB_ID).header("Authorization", aliceToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void listingAllUsersIsNoLongerPossible() throws Exception {
        mvc.perform(get("/api/v1/users").header("Authorization", aliceToken))
                .andExpect(status().isNotFound());
    }

    // ---- workflow webhook (previously: unauthenticated, unthrottled email trigger) -----------

    @Test
    void workflowWebhookRequiresSharedSecret() throws Exception {
        String body = "{\"subscriptionId\":\"abc\"}";

        mvc.perform(post("/api/v1/workflows/subscription/reminder")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/v1/workflows/subscription/reminder")
                        .header("X-Workflow-Token", "wrong")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/v1/workflows/subscription/reminder")
                        .header("X-Workflow-Token", "correct-workflow-token")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    // ---- sign-in (previously: 404 "User Not Found" vs 401 "Invalid Password") -----------------

    @Test
    void signInDoesNotRevealWhetherTheEmailExists() throws Exception {
        String unknown = mvc.perform(post("/api/v1/auth/sign-in").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ghost@example.com\",\"password\":\"whatever1\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String wrongPassword = mvc.perform(post("/api/v1/auth/sign-in").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"whatever1\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        org.junit.jupiter.api.Assertions.assertEquals(unknown, wrongPassword);
    }

    @Test
    void signUpValidationRejectsBadInput() throws Exception {
        mvc.perform(post("/api/v1/auth/sign-up").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"a\",\"email\":\"a@b\",\"password\":\"" + "x".repeat(200) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    // ---- CORS (previously: any origin reflected, with credentials) ---------------------------

    @Test
    void corsPreflightFromUnknownOriginIsRejected() throws Exception {
        mvc.perform(options("/api/v1/subscriptions")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void corsPreflightFromConfiguredOriginIsAllowed() throws Exception {
        mvc.perform(options("/api/v1/subscriptions")
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
    }

    // ---- error handling -----------------------------------------------------------------

    @Test
    void unknownRouteForAuthenticatedUserIs404Not500() throws Exception {
        mvc.perform(get("/api/v1/does-not-exist").header("Authorization", aliceToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void wrongMethodIs405Not500() throws Exception {
        mvc.perform(put("/api/v1/users/me").header("Authorization", aliceToken))
                .andExpect(status().isMethodNotAllowed());
    }

    // ---- statement upload ---------------------------------------------------------------------

    private static MockMultipartFile csv(String name, String content) {
        return new MockMultipartFile("file", name, "text/csv", content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void statementUploadRequiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/v1/statements/analyze").file(csv("s.csv", "Date,Description,Amount\n")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void statementUploadRejectsNonCsvFiles() throws Exception {
        mvc.perform(multipart("/api/v1/statements/analyze")
                        .file(csv("statement.exe", "MZ"))
                        .header("Authorization", aliceToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void statementUploadWithoutAFileIs400Not500() throws Exception {
        mvc.perform(multipart("/api/v1/statements/analyze").header("Authorization", aliceToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void statementUploadWithGarbageCsvIs400Not500() throws Exception {
        mvc.perform(multipart("/api/v1/statements/analyze")
                        .file(csv("junk.csv", "this,is\nnot,a,statement"))
                        .header("Authorization", aliceToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void statementUploadDetectsRecurringCharges() throws Exception {
        String csv = String.join("\n",
                "Date,Description,Amount",
                "2026-07-05,NETFLIX.COM,-15.49",
                "2026-08-05,NETFLIX.COM,-15.49",
                "2026-09-05,NETFLIX.COM,-15.49",
                "2026-10-05,NETFLIX.COM,-15.49");
        mvc.perform(multipart("/api/v1/statements/analyze")
                        .file(csv("ok.csv", csv))
                        .header("Authorization", aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.transactionsScanned").value(4))
                .andExpect(jsonPath("$.data.detected[0].name").value("Netflix"))
                .andExpect(jsonPath("$.data.detected[0].frequency").value("monthly"));
    }
}
