package com.billpilot.dto.request;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.SubscriptionStatus;
import jakarta.validation.constraints.DecimalMin;
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
    private String name;

    @DecimalMin(value = "0.0", message = "Price must be greater than or equal to 0")
    private Double price;

    private String currency;
    private Frequency frequency;
    private Category category;
    private String paymentMethod;
    private SubscriptionStatus status;
    private LocalDate startDate;
    private LocalDate renewalDate;
}
