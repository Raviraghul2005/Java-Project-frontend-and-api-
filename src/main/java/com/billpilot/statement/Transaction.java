package com.billpilot.statement;

import java.time.LocalDate;

/** A single debit (money out) row from a bank or card statement. Amount is always positive. */
public record Transaction(LocalDate date, String description, double amount) {
}
