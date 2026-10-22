package com.billpilot.util;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.Subscription;
import com.billpilot.model.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

class EmailTemplateEscapingTest {

    private Subscription sub(String name, String paymentMethod) {
        return Subscription.builder().name(name).price(9.5).currency("USD").frequency(Frequency.MONTHLY)
                .category(Category.OTHER).paymentMethod(paymentMethod).renewalDate(LocalDate.now().plusDays(5))
                .user("u1").build();
    }

    @Test
    void htmlInUserControlledFieldsIsEscaped() {
        User user = User.builder().name("<script>alert(1)</script>").email("a@b.co").build();
        Subscription s = sub("<img src=x onerror=alert(1)>", "<b>Visa</b>");

        String html = EmailTemplateBuilder.buildReminderEmail(s, user, 5).htmlBody();

        assertFalse(html.contains("<script>"));
        assertFalse(html.contains("<img src=x"));
        assertFalse(html.contains("<b>Visa</b>"));
        assertTrue(html.contains("&lt;script&gt;"));
        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
    }

    @Test
    void lineBreaksCannotInjectHeadersViaTheSubject() {
        User user = User.builder().name("A").email("a@b.co").build();
        Subscription s = sub("Netflix\r\nBcc: attacker@evil.test", "Card");

        String subject = EmailTemplateBuilder.buildReminderEmail(s, user, 5).subject();

        assertFalse(subject.contains("\r"));
        assertFalse(subject.contains("\n"));
    }

    @Test
    void priceUsesDotDecimalRegardlessOfDefaultLocale() {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.GERMANY);
            User user = User.builder().name("A").email("a@b.co").build();
            String html = EmailTemplateBuilder.buildReminderEmail(sub("Netflix", "Card"), user, 5).htmlBody();
            assertTrue(html.contains("9.50"));
        } finally {
            Locale.setDefault(original);
        }
    }

    @Test
    void missingFrequencyDoesNotThrow() {
        User user = User.builder().name("A").email("a@b.co").build();
        Subscription s = sub("Netflix", "Card");
        s.setFrequency(null);

        assertDoesNotThrow(() -> EmailTemplateBuilder.buildReminderEmail(s, user, 7));
    }
}
