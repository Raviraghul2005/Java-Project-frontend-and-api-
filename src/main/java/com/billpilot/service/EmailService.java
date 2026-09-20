package com.billpilot.service;

import com.billpilot.model.Subscription;
import com.billpilot.model.User;
import com.billpilot.util.EmailTemplateBuilder;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.sender-email:lymo.network@gmail.com}")
    private String senderEmail;

    @Value("${app.mail.sender-name:Bill Pilot}")
    private String senderName;

    @Async
    public void sendRenewalReminderEmail(Subscription subscription, User user, int daysLeft) {
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            log.warn("Cannot send reminder: User {} has no valid email", user.getId());
            return;
        }

        EmailTemplateBuilder.EmailPayload payload = EmailTemplateBuilder.buildReminderEmail(subscription, user, daysLeft);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

            helper.setFrom(senderEmail, senderName);
            helper.setTo(user.getEmail());
            helper.setSubject(payload.subject());
            helper.setText(payload.htmlBody(), true);

            mailSender.send(message);
            log.info("Renewal reminder email ({} days before) sent to {}", daysLeft, user.getEmail());
        } catch (MessagingException e) {
            log.error("Failed to construct/send reminder email to {}: {}", user.getEmail(), e.getMessage());
        } catch (Exception e) {
            log.error("Email service error: {}", e.getMessage());
        }
    }
}
