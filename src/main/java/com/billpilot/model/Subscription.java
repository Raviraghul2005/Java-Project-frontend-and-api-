package com.billpilot.model;

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

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public void calculateRenewalDateIfMissing() {
        if (this.renewalDate == null && this.startDate != null && this.frequency != null) {
            this.renewalDate = switch (this.frequency) {
                case DAILY -> this.startDate.plusDays(1);
                case WEEKLY -> this.startDate.plusDays(7);
                case MONTHLY -> this.startDate.plusDays(30);
                case YEARLY -> this.startDate.plusDays(365);
            };
        }

        if (this.renewalDate != null && this.renewalDate.isBefore(LocalDate.now())) {
            this.status = SubscriptionStatus.EXPIRED;
        }
    }
}
