package com.billpilot.util;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class EmailTemplateBuilderTest {

    @Test
    void testBuildReminderEmail_7Days() {
        User user = User.builder()
                .name("Alex")
                .email("alex@example.com")
                .build();

        Subscription sub = Subscription.builder()
                .name("Spotify")
                .price(9.99)
                .currency("USD")
                .frequency(Frequency.MONTHLY)
                .category(Category.ENTERTAINMENT)
                .paymentMethod("Credit Card")
                .renewalDate(LocalDate.now().plusDays(7))
                .user("user123")
                .build();

        EmailTemplateBuilder.EmailPayload payload = EmailTemplateBuilder.buildReminderEmail(sub, user, 7);

        assertNotNull(payload);
        assertTrue(payload.subject().contains("7 Days"));
        assertTrue(payload.subject().contains("Spotify"));
        assertTrue(payload.htmlBody().contains("Alex"));
        assertTrue(payload.htmlBody().contains("Spotify"));
        assertTrue(payload.htmlBody().contains("9.99"));
        assertTrue(payload.htmlBody().contains("Bill Pilot"));
    }

    @Test
    void testBuildReminderEmail_1Day() {
        User user = User.builder()
                .name("Alex")
                .email("alex@example.com")
                .build();

        Subscription sub = Subscription.builder()
                .name("GitHub Copilot")
                .price(10.0)
                .currency("USD")
                .frequency(Frequency.MONTHLY)
                .category(Category.TECHNOLOGY)
                .paymentMethod("PayPal")
                .renewalDate(LocalDate.now().plusDays(1))
                .user("user123")
                .build();

        EmailTemplateBuilder.EmailPayload payload = EmailTemplateBuilder.buildReminderEmail(sub, user, 1);

        assertTrue(payload.subject().contains("Tomorrow"));
    }
}
