package com.billpilot.dto.request;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.SubscriptionStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSubscriptionRequest {
    @Size(min = 2, max = 100, message = "Subscription name must be between 2 and 100 characters")
    private String name;

    @DecimalMin(value = "0.0", message = "Price must be greater than or equal to 0")
    @DecimalMax(value = "1000000", message = "Price must not exceed 1,000,000")
    private Double price;

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code such as USD")
    private String currency;
    private Frequency frequency;
    private Category category;
    @Pattern(regexp = ".*\\S.*", message = "Payment method must not be blank")
    @Size(max = 100, message = "Payment method must be at most 100 characters")
    private String paymentMethod;
    private SubscriptionStatus status;
    private LocalDate startDate;
    private LocalDate renewalDate;

    @JsonIgnore
    @AssertTrue(message = "Dates must be between 1970 and 2200")
    public boolean isDatesInSaneRange() {
        return DateRanges.isSane(startDate) && DateRanges.isSane(renewalDate);
    }
}
