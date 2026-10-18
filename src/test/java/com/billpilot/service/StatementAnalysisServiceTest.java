package com.billpilot.service;

import com.billpilot.dto.response.StatementAnalysisResponse;
import com.billpilot.exception.BadRequestException;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.statement.RecurringDetector;
import com.billpilot.statement.StatementParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class StatementAnalysisServiceTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;

    private StatementAnalysisService service;
    private final User user = User.builder().id("u1").name("Student").email("s@example.com").build();

    private static final String CSV = """
            Date,Description,Debit
            2026-05-02,NETFLIX.COM,15.49
            2026-06-02,NETFLIX.COM,15.49
            2026-07-02,NETFLIX.COM,15.49
            2026-05-05,SPOTIFY,11.99
            2026-06-05,SPOTIFY,11.99
            2026-07-05,SPOTIFY,11.99
            """;

    @BeforeEach
    void setUp() {
        service = new StatementAnalysisService(new StatementParser(), new RecurringDetector(), subscriptionRepository);
        lenient().when(subscriptionRepository.findByUser("u1")).thenReturn(List.of());
    }

    private MockMultipartFile csv(String name, String body) {
        return new MockMultipartFile("file", name, "text/csv", body.getBytes());
    }

    @Test
    void reportsDetectedSubscriptionsAndTotals() {
        StatementAnalysisResponse r = service.analyze(csv("may.csv", CSV), user);

        assertEquals(6, r.getTransactionsScanned());
        assertEquals(2, r.getDetected().size());
        assertEquals(2, r.getUntrackedCount());
        assertEquals(27.48, r.getDetectedMonthlyTotal());
        assertEquals(27.48, r.getUntrackedMonthlyTotal());
    }

    @Test
    void marksAlreadyTrackedSubscriptions() {
        Subscription tracked = Subscription.builder()
                .id("s1").name("Netflix Premium").price(15.49).frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT).status(SubscriptionStatus.ACTIVE)
                .startDate(LocalDate.now()).user("u1").build();
        lenient().when(subscriptionRepository.findByUser("u1")).thenReturn(List.of(tracked));

        StatementAnalysisResponse r = service.analyze(csv("may.csv", CSV), user);

        assertEquals(1, r.getUntrackedCount());
        assertEquals(11.99, r.getUntrackedMonthlyTotal());
        assertTrue(r.getDetected().stream().filter(d -> d.getName().equals("Netflix")).findFirst().orElseThrow().isAlreadyTracked());
        assertFalse(r.getDetected().stream().filter(d -> d.getName().equals("Spotify")).findFirst().orElseThrow().isAlreadyTracked());
    }

    @Test
    void cancelledSubscriptionsDoNotCountAsTracked() {
        Subscription cancelled = Subscription.builder()
                .id("s1").name("Netflix").price(15.49).frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT).status(SubscriptionStatus.CANCELLED)
                .startDate(LocalDate.now()).user("u1").build();
        lenient().when(subscriptionRepository.findByUser("u1")).thenReturn(List.of(cancelled));

        StatementAnalysisResponse r = service.analyze(csv("may.csv", CSV), user);

        assertEquals(2, r.getUntrackedCount());
    }

    @Test
    void rejectsNonCsvAndEmptyFiles() {
        assertThrows(BadRequestException.class, () -> service.analyze(csv("statement.pdf", CSV), user));
        assertThrows(BadRequestException.class, () -> service.analyze(csv("empty.csv", ""), user));
        assertThrows(BadRequestException.class, () -> service.analyze(null, user));
    }
}
