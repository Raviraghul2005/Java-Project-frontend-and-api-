package com.billpilot.dto.request;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class CreateSubscriptionRequest {

    @NotBlank(message = "Subscription name is required")
    @Size(min = 2, max = 100, message = "Subscription name must be between 2 and 100 characters")
    private String name;

    @NotNull(message = "Subscription price is required")
    @DecimalMin(value = "0.0", message = "Price must be greater than or equal to 0")
    @DecimalMax(value = "1000000", message = "Price must not exceed 1,000,000")
    private Double price;

    @Builder.Default
    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code such as USD")
    private String currency = "USD";

    @NotNull(message = "Frequency is required")
    private Frequency frequency;

    @NotNull(message = "Category is required")
    private Category category;

    @NotBlank(message = "Payment method is required")
    @Size(max = 100, message = "Payment method must be at most 100 characters")
    private String paymentMethod;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    private LocalDate renewalDate;

    @JsonIgnore
    @AssertTrue(message = "Dates must be between 1970 and 2200")
    public boolean isDatesInSaneRange() {
        return DateRanges.isSane(startDate) && DateRanges.isSane(renewalDate);
    }
}
