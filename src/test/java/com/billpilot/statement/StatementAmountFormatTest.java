package com.billpilot.statement;

import com.billpilot.model.Frequency;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Number-format handling for statements exported in different regional layouts. */
class StatementAmountFormatTest {

    @Test
    void plainAndDotDecimalAmounts() {
        assertEquals(9.99, StatementParser.parseAmount("9.99"));
        assertEquals(1234.56, StatementParser.parseAmount("1,234.56"));
        assertEquals(123456.78, StatementParser.parseAmount("1,23,456.78")); // Indian digit grouping
        assertEquals(-9.99, StatementParser.parseAmount("-9.99"));
        assertEquals(-50.0, StatementParser.parseAmount("(50.00)"));
        assertEquals(15.0, StatementParser.parseAmount("$15"));
    }

    @Test
    void decimalCommaAmountsAreNotReadAsThousands() {
        assertEquals(9.99, StatementParser.parseAmount("9,99"));
        assertEquals(12.5, StatementParser.parseAmount("12,5"));
        assertEquals(1234.56, StatementParser.parseAmount("1.234,56"));
        assertEquals(1234567.89, StatementParser.parseAmount("1.234.567,89"));
        assertEquals(-9.99, StatementParser.parseAmount("-9,99 €"));
    }

    @Test
    void commaFollowedByThreeDigitsIsAThousandsSeparator() {
        assertEquals(1234.0, StatementParser.parseAmount("1,234"));
        assertEquals(1234567.0, StatementParser.parseAmount("1,234,567"));
    }

    @Test
    void semicolonSeparatedEuropeanStatementParsesCorrectAmounts() {
        String csv = String.join("\n",
                "Date;Description;Amount",
                "2026-01-05;NETFLIX.COM;-12,99",
                "2026-02-05;NETFLIX.COM;-12,99",
                "2026-03-05;NETFLIX.COM;-12,99");

        List<Transaction> parsed = new StatementParser()
                .parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));

        assertEquals(3, parsed.size());
        parsed.forEach(t -> assertEquals(12.99, t.amount(), 0.0001));
    }

    @Test
    void monthlyEquivalentUsesExactCalendarFactorsLikeTheAudit() {
        assertEquals(10.0, RecurringDetector.toMonthly(10.0, Frequency.MONTHLY), 1e-9);
        assertEquals(10.0, RecurringDetector.toMonthly(120.0, Frequency.YEARLY), 1e-9);
        assertEquals(52.0, RecurringDetector.toMonthly(12.0, Frequency.WEEKLY), 1e-9);
        assertEquals(365.0, RecurringDetector.toMonthly(12.0, Frequency.DAILY), 1e-9);
    }
}
