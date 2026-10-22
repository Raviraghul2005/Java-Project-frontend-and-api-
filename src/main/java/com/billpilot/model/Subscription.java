package com.billpilot.model;

import com.billpilot.util.RenewalCalculator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.time.Instant;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "subscriptions")
public class Subscription {

    /** How many days past its renewal date an active subscription may be before it is rolled forward. */
    static final int OVERDUE_GRACE_DAYS = 1;

    @Id
    private String id;

    @NotBlank(message = "Subscription name is required")
    @Size(min = 2, max = 100, message = "Subscription name must be between 2 and 100 characters")
    private String name;

    @NotNull(message = "Subscription price is required")
    @DecimalMin(value = "0.0", message = "Price must be greater than or equal to 0")
    private Double price;

    @Builder.Default
    private String currency = "USD";

    @NotNull(message = "Frequency is required")
    private Frequency frequency;

    @NotNull(message = "Category is required")
    private Category category;

    @NotBlank(message = "Payment method is required")
    private String paymentMethod;

    @Builder.Default
    private SubscriptionStatus status = SubscriptionStatus.ACTIVE;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    private LocalDate renewalDate;

    @Indexed
    @NotBlank(message = "User ID is required")
    @Field(targetType = FieldType.OBJECT_ID)
    private String user;

    /**
     * Reminder bookkeeping: the renewal date and "days before" threshold of the last reminder email
     * dispatched, so the daily job and the workflow webhook never send the same reminder twice.
     */
    @JsonIgnore
    private LocalDate lastReminderRenewalDate;

    @JsonIgnore
    private Integer lastReminderDaysLeft;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    /** Sets the first renewal (one billing period after the start date) when none was supplied. */
    public void calculateRenewalDateIfMissing() {
        if (this.renewalDate == null && this.startDate != null && this.frequency != null) {
            this.renewalDate = RenewalCalculator.firstRenewal(this.startDate, this.frequency);
        }
    }

    /**
     * Advances a past renewal date to the next upcoming billing date. An active subscription keeps
     * renewing until it is cancelled; it is never expired just because a billing date went by.
     */
    public void rollRenewalDateForward(LocalDate today) {
        if (this.status == SubscriptionStatus.ACTIVE && this.renewalDate != null && this.frequency != null) {
            // The server does not know the user's timezone, so its "today" can be a day ahead of theirs.
            // Only roll once the date is more than a day overdue, otherwise a renewal on the user's today
            // would be advanced a day early.
            LocalDate threshold = today.minusDays(OVERDUE_GRACE_DAYS);
            this.renewalDate = RenewalCalculator.rollForward(this.renewalDate, this.frequency, threshold, billingDay());
        }
    }

    /**
     * The day of month this subscription is billed on. Normally the renewal date's own day; the start
     * date's day is used only when the renewal date is consistent with it, i.e. a month-end clamp such as
     * a plan started on the 31st renewing on Feb 28 (so it returns to the 31st instead of drifting).
     */
    private int billingDay() {
        int day = this.renewalDate.getDayOfMonth();
        if (this.startDate != null) {
            int startDay = this.startDate.getDayOfMonth();
            if (day == Math.min(startDay, this.renewalDate.lengthOfMonth())) {
                return startDay;
            }
        }
        return day;
    }
}
