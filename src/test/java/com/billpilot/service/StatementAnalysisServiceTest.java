package com.billpilot.service;

import com.billpilot.dto.response.DetectedSubscription;
import com.billpilot.dto.response.StatementAnalysisResponse;
import com.billpilot.exception.BadRequestException;
import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import com.billpilot.model.User;
import com.billpilot.repository.SubscriptionRepository;
import com.billpilot.statement.RecurringDetector;
import com.billpilot.statement.SharedDescriptorSummary;
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

    /** billpilot_stream_separation_kit/_kit/sample-statement-shared.csv: Apple and Amazon hide several charges each. */
    private static final String SHARED_CSV = """
            Date,Description,Debit,Credit
            2025-11-02,NETFLIX.COM 8007 CA,15.49,
            2025-11-03,APPLE.COM/BILL 866-712-7753,4.99,
            2025-11-05,UPI-SPOTIFY-4421@ybl,11.99,
            2025-11-07,SALARY CREDIT,,2400.00
            2025-11-09,AMZN MKTP US*2K4,14.99,
            2025-11-12,GROCERY MART,43.10,
            2025-11-14,APPLE.COM/BILL 866-712-7753,2.99,
            2025-11-16,APPLE.COM/BILL 866-712-7753,10.99,
            2025-11-20,AMZN MKTP US*7Q1,36.40,
            2025-12-02,NETFLIX.COM 8007 CA,15.49,
            2025-12-03,APPLE.COM/BILL 866-712-7753,4.99,
            2025-12-05,UPI-SPOTIFY-4421@ybl,11.99,
            2025-12-09,AMZN MKTP US*2K4,14.99,
            2025-12-12,GROCERY MART,51.30,
            2025-12-14,APPLE.COM/BILL 866-712-7753,2.99,
            2025-12-15,APPLE.COM/BILL 866-712-7753,10.99,
            2026-01-02,NETFLIX.COM 8007 CA,15.49,
            2026-01-03,APPLE.COM/BILL 866-712-7753,4.99,
            2026-01-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-01-09,AMZN MKTP US*1Z8,22.15,
            2026-01-09,AMZN MKTP US*2K4,14.99,
            2026-01-12,GROCERY MART,38.65,
            2026-01-15,APPLE.COM/BILL 866-712-7753,13.98,
            2026-02-02,NETFLIX.COM 8007 CA,15.49,
            2026-02-03,APPLE.COM/BILL 866-712-7753,4.99,
            2026-02-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-02-09,AMZN MKTP US*2K4,14.99,
            2026-02-12,GROCERY MART,47.20,
            2026-02-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-02-15,APPLE.COM/BILL 866-712-7753,10.99,
            2026-02-26,AMZN MKTP US*4M2,58.00,
            2026-03-02,NETFLIX.COM 8007 CA,15.49,
            2026-03-05,APPLE.COM/BILL 866-712-7753,4.99,
            2026-03-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-03-09,AMZN MKTP US*2K4,14.99,
            2026-03-12,GROCERY MART,55.80,
            2026-03-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-03-16,APPLE.COM/BILL 866-712-7753,10.99,
            2026-03-22,APPLE.COM/BILL 866-712-7753,1.99,
            2026-04-02,NETFLIX.COM 8007 CA,15.49,
            2026-04-03,APPLE.COM/BILL 866-712-7753,4.99,
            2026-04-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-04-09,AMZN MKTP US*2K4,14.99,
            2026-04-09,AMZN MKTP US*9P3,14.99,
            2026-04-12,GROCERY MART,40.10,
            2026-04-15,APPLE.COM/BILL 866-712-7753,13.98,
            2026-05-02,NETFLIX.COM 8007 CA,15.49,
            2026-05-03,APPLE.COM/BILL 866-712-7753,4.99,
            2026-05-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-05-09,AMZN MKTP US*2K4,14.99,
            2026-05-12,GROCERY MART,44.90,
            2026-05-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-05-16,APPLE.COM/BILL 866-712-7753,10.99,
            2026-05-17,AMZN MKTP US*3K7,11.25,
            2026-06-02,NETFLIX.COM 8007 CA,15.49,
            2026-06-03,APPLE.COM/BILL 866-712-7753,5.99,
            2026-06-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-06-09,AMZN MKTP US*2K4,14.99,
            2026-06-09,APPLE.COM/BILL 866-712-7753,0.99,
            2026-06-12,GROCERY MART,39.75,
            2026-06-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-06-15,APPLE.COM/BILL 866-712-7753,10.99,
            2026-07-02,NETFLIX.COM 8007 CA,15.49,
            2026-07-03,APPLE.COM/BILL 866-712-7753,5.99,
            2026-07-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-07-09,AMZN MKTP US*2K4,14.99,
            2026-07-12,GROCERY MART,52.60,
            2026-07-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-07-16,APPLE.COM/BILL 866-712-7753,10.99,
            2026-07-30,AMZN MKTP US*8L5,74.90,
            2026-08-02,NETFLIX.COM 8007 CA,15.49,
            2026-08-03,APPLE.COM/BILL 866-712-7753,5.99,
            2026-08-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-08-09,AMZN MKTP US*2K4,14.99,
            2026-08-09,AMZN MKTP US*2R6,19.99,
            2026-08-12,GROCERY MART,46.30,
            2026-08-15,APPLE.COM/BILL 866-712-7753,13.98,
            2026-09-02,NETFLIX.COM 8007 CA,15.49,
            2026-09-03,APPLE.COM/BILL 866-712-7753,5.99,
            2026-09-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-09-09,AMZN MKTP US*2K4,14.99,
            2026-09-12,GROCERY MART,41.15,
            2026-09-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-09-16,APPLE.COM/BILL 866-712-7753,10.99,
            2026-09-27,APPLE.COM/BILL 866-712-7753,4.99,
            2026-10-01,AMZN MKTP US*5T9,27.30,
            2026-10-02,NETFLIX.COM 8007 CA,15.49,
            2026-10-03,APPLE.COM/BILL 866-712-7753,5.99,
            2026-10-05,UPI-SPOTIFY-4421@ybl,11.99,
            2026-10-09,AMZN MKTP US*2K4,14.99,
            2026-10-12,GROCERY MART,49.90,
            2026-10-14,APPLE.COM/BILL 866-712-7753,2.99,
            2026-10-15,APPLE.COM/BILL 866-712-7753,10.99,
            """;

    /** Netflix runs to October while Apple 5.99 stops after May: that stream is stopped. */
    private static final String STOPPED_CSV = """
            Date,Description,Debit
            2026-01-02,NETFLIX.COM,15.49
            2026-02-02,NETFLIX.COM,15.49
            2026-03-02,NETFLIX.COM,15.49
            2026-04-02,NETFLIX.COM,15.49
            2026-05-02,NETFLIX.COM,15.49
            2026-06-02,NETFLIX.COM,15.49
            2026-07-02,NETFLIX.COM,15.49
            2026-08-02,NETFLIX.COM,15.49
            2026-09-02,NETFLIX.COM,15.49
            2026-10-02,NETFLIX.COM,15.49
            2026-01-03,APPLE.COM/BILL 866-712-7753,5.99
            2026-02-03,APPLE.COM/BILL 866-712-7753,5.99
            2026-03-03,APPLE.COM/BILL 866-712-7753,5.99
            2026-04-03,APPLE.COM/BILL 866-712-7753,5.99
            2026-05-03,APPLE.COM/BILL 866-712-7753,5.99
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

    private static Subscription tracking(String id, String name, double price, int renewalDay) {
        return Subscription.builder()
                .id(id).name(name).price(price).frequency(Frequency.MONTHLY)
                .category(Category.TECHNOLOGY).status(SubscriptionStatus.ACTIVE)
                .startDate(LocalDate.of(2025, 11, 1)).renewalDate(LocalDate.of(2026, 11, renewalDay)).user("u1").build();
    }

    private static DetectedSubscription appleStream(StatementAnalysisResponse r, double amount) {
        return r.getDetected().stream()
                .filter(d -> "Apple".equals(d.getSharedDescriptor()) && d.getAmount() == amount)
                .findFirst().orElseThrow();
    }

    @Test
    void separatesStreamsHiddenUnderSharedDescriptors() {
        StatementAnalysisResponse r = service.analyze(csv("shared.csv", SHARED_CSV), user);

        assertEquals(6, r.getDetected().size());
        assertEquals(2, r.getDetected().stream().filter(d -> d.getSharedDescriptor() == null).count());
        assertEquals(3, r.getDetected().stream().filter(d -> "Apple".equals(d.getSharedDescriptor())).count());
        DetectedSubscription amazon = r.getDetected().stream()
                .filter(d -> "Amazon".equals(d.getSharedDescriptor())).findFirst().orElseThrow();
        assertEquals(14.99, amazon.getAmount());
        assertEquals(9, amazon.getAnchorDay());
        assertEquals("Amazon subscription · 14.99 on the 9th", amazon.getName());

        assertEquals(2, r.getSharedDescriptors().size());
        assertEquals(3, summary(r, "Apple").oneOffCount());
        assertEquals(8, summary(r, "Amazon").oneOffCount());
        assertEquals("APPLE.COM/BILL", summary(r, "Apple").descriptor());
        assertEquals("AMZN MKTP US", summary(r, "Amazon").descriptor());
    }

    private static SharedDescriptorSummary summary(StatementAnalysisResponse r, String label) {
        return r.getSharedDescriptors().stream().filter(s -> s.label().equals(label)).findFirst().orElseThrow();
    }

    @Test
    void sharedStreamMatchesATrackedSubscriptionByPriceAndBillingDay() {
        lenient().when(subscriptionRepository.findByUser("u1")).thenReturn(List.of(tracking("s1", "iCloud+", 2.99, 14)));

        StatementAnalysisResponse r = service.analyze(csv("shared.csv", SHARED_CSV), user);

        DetectedSubscription icloud = appleStream(r, 2.99);
        assertTrue(icloud.isAlreadyTracked());
        assertEquals("iCloud+", icloud.getTrackedName());
        assertFalse(appleStream(r, 10.99).isAlreadyTracked());
        assertNull(appleStream(r, 10.99).getTrackedName());
        assertEquals(5, r.getUntrackedCount());
    }

    @Test
    void aTrackedSubscriptionMatchesOnlyTheClosestStream() {
        // both are 2.99 monthly and within 3 days of the 14th; the 14th is closer
        lenient().when(subscriptionRepository.findByUser("u1")).thenReturn(List.of(
                tracking("s1", "Far", 2.99, 16), tracking("s2", "Near", 2.99, 14)));

        StatementAnalysisResponse r = service.analyze(csv("shared.csv", SHARED_CSV), user);

        assertEquals("Near", appleStream(r, 2.99).getTrackedName());
        assertEquals(5, r.getUntrackedCount());
    }

    @Test
    void aTrackedSubscriptionOnAnotherDayOrPriceDoesNotMatch() {
        lenient().when(subscriptionRepository.findByUser("u1")).thenReturn(List.of(
                tracking("s1", "Wrong day", 2.99, 24), tracking("s2", "Wrong price", 3.49, 14)));

        StatementAnalysisResponse r = service.analyze(csv("shared.csv", SHARED_CSV), user);

        assertFalse(appleStream(r, 2.99).isAlreadyTracked());
        assertEquals(6, r.getUntrackedCount());
    }

    @Test
    void billingDaysCountCircularly() {
        assertEquals(1, StatementAnalysisService.dayDistance(31, 1));
        assertEquals(3, StatementAnalysisService.dayDistance(29, 1));
        assertEquals(0, StatementAnalysisService.dayDistance(14, 14));
        assertEquals(10, StatementAnalysisService.dayDistance(14, 24));
    }

    @Test
    void stoppedStreamsAreNotCountedInTheTotals() {
        StatementAnalysisResponse r = service.analyze(csv("stopped.csv", STOPPED_CSV), user);

        assertEquals(2, r.getDetected().size());
        DetectedSubscription apple = r.getDetected().stream()
                .filter(d -> "Apple".equals(d.getSharedDescriptor())).findFirst().orElseThrow();
        assertEquals("stopped", apple.getStatus());
        assertNull(apple.getNextExpected());
        assertEquals(15.49, r.getDetectedMonthlyTotal());
        assertEquals(15.49, r.getUntrackedMonthlyTotal());
        assertEquals(1, r.getUntrackedCount());
    }
}
