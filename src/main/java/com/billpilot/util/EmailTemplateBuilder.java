package com.billpilot.util;

import com.billpilot.model.Subscription;
import com.billpilot.model.User;

import java.time.format.DateTimeFormatter;

public class EmailTemplateBuilder {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");

    public record EmailPayload(String subject, String htmlBody) {}

    public static EmailPayload buildReminderEmail(Subscription subscription, User user, int daysLeft) {
        String renewalDateFormatted = subscription.getRenewalDate() != null
                ? subscription.getRenewalDate().format(DATE_FORMATTER)
                : "Soon";

        String formattedPrice = String.format("%s %.2f (%s)",
                subscription.getCurrency(),
                subscription.getPrice(),
                subscription.getFrequency().getValue());

        String subject = switch (daysLeft) {
            case 7 -> String.format("📅 Reminder: Your %s Subscription Renews in 7 Days!", subscription.getName());
            case 5 -> String.format("⏳ %s Renews in 5 Days – Stay Subscribed!", subscription.getName());
            case 2 -> String.format("🚀 2 Days Left! %s Subscription Renewal", subscription.getName());
            case 1 -> String.format("⚡ Final Reminder: %s Renews Tomorrow!", subscription.getName());
            default -> String.format("🔔 Reminder: Your %s Subscription is Renewing Soon!", subscription.getName());
        };

        String html = String.format("""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f4f7fa;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%%" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background-color: #4a90e2; text-align: center; padding: 25px 0;">
                            <span style="font-size: 42px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">Bill Pilot</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="font-size: 16px; margin-bottom: 25px;">Hello <strong style="color: #4a90e2;">%s</strong>,</p>
                            
                            <p style="font-size: 16px; margin-bottom: 25px;">Your <strong>%s</strong> subscription is set to renew on <strong style="color: #4a90e2;">%s</strong> (%d days from today).</p>
                            
                            <table cellpadding="15" cellspacing="0" border="0" width="100%%" style="background-color: #f0f7ff; border-radius: 10px; margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 16px; border-bottom: 1px solid #d0e3ff;">
                                        <strong>Plan:</strong> %s
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 16px; border-bottom: 1px solid #d0e3ff;">
                                        <strong>Price:</strong> %s
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 16px;">
                                        <strong>Payment Method:</strong> %s
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="font-size: 16px; margin-bottom: 25px;">If you'd like to make changes or cancel your subscription, please visit your account settings before the renewal date.</p>
                            
                            <p style="font-size: 16px; margin-top: 30px;">
                                Best regards,<br>
                                <strong>The Bill Pilot Team</strong>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f0f7ff; padding: 20px; text-align: center; font-size: 14px; color: #777;">
                            <p style="margin: 0 0 10px;">
                                Bill Pilot Inc. | Subscription Management Platform
                            </p>
                        </td>
                    </tr>
                </table>
            </div>
            """,
                user.getName(),
                subscription.getName(),
                renewalDateFormatted,
                daysLeft,
                subscription.getName(),
                formattedPrice,
                subscription.getPaymentMethod()
        );

        return new EmailPayload(subject, html);
    }
}
