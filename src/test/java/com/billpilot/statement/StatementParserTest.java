package com.billpilot.statement;

import com.billpilot.exception.BadRequestException;
import com.billpilot.dto.response.DetectedSubscription;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StatementParserTest {

    private final StatementParser parser = new StatementParser();

    private List<Transaction> parse(String csv) {
        return parser.parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void parsesDebitCreditLayoutAndSkipsCredits() {
        List<Transaction> t = parse("""
                Date,Description,Debit,Credit
                2026-05-02,NETFLIX,15.49,
                2026-05-07,SALARY,,2400.00
                """);
        assertEquals(1, t.size());
        assertEquals(15.49, t.get(0).amount());
        assertEquals(LocalDate.parse("2026-05-02"), t.get(0).date());
    }

    @Test
    void parsesSignedAmountLayoutKeepingOnlyNegatives() {
        List<Transaction> t = parse("""
                Transaction Date,Narration,Amount
                05/06/2026,SPOTIFY,-11.99
                06/06/2026,REFUND,25.00
                """);
        assertEquals(1, t.size());
        assertEquals(11.99, t.get(0).amount());
        assertEquals(LocalDate.parse("2026-06-05"), t.get(0).date(), "dd/MM/yyyy should win when both parse");
    }

    @Test
    void treatsAllPositiveSingleColumnAsDebits() {
        List<Transaction> t = parse("""
                Date,Description,Amount
                2026-05-02,NETFLIX,15.49
                2026-06-02,NETFLIX,15.49
                """);
        assertEquals(2, t.size());
    }

    @Test
    void picksMonthFirstFormatWhenDaysExceedTwelve() {
        List<Transaction> t = parse("""
                Date,Description,Amount
                05/25/2026,NETFLIX,-15.49
                06/25/2026,NETFLIX,-15.49
                """);
        assertEquals(LocalDate.parse("2026-05-25"), t.get(0).date());
    }

    @Test
    void handlesQuotedFieldsThousandsSeparatorsAndBom() {
        List<Transaction> t = parse("﻿Date,Description,Debit\n"
                + "2026-05-02,\"ADOBE, INC \"\"CC\"\"\",\"1,299.00\"\n");
        assertEquals(1, t.size());
        assertEquals(1299.00, t.get(0).amount());
        assertEquals("ADOBE, INC \"CC\"", t.get(0).description());
    }

    @Test
    void skipsPreambleRowsAboveHeaderAndSupportsSemicolons() {
        List<Transaction> t = parse("Account;12345\nStatement;May 2026\nDate;Description;Amount\n2026-05-02;NETFLIX;-15.49\n");
        assertEquals(1, t.size());
    }

    @Test
    void rejectsFileWithoutRecognisableColumns() {
        assertThrows(BadRequestException.class, () -> parse("foo,bar\n1,2\n"));
    }

    @Test
    void rejectsEmptyFile() {
        assertThrows(BadRequestException.class, () -> parse(""));
    }

    @Test
    void sampleStatementEndToEnd() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/sample-statement.csv")) {
            List<Transaction> txns = parser.parse(in);
            assertEquals(25, txns.size(), "salary credits must be skipped");

            List<DetectedSubscription> found = new RecurringDetector().detect(txns);
            List<String> names = found.stream().map(DetectedSubscription::getName).toList();

            assertTrue(names.containsAll(List.of("Netflix", "Spotify", "Prime Video", "ChatGPT Plus", "Gym Fit")), names.toString());
            assertFalse(names.contains("Starbucks"), "varying coffee purchases must not be flagged");
            assertFalse(names.stream().anyMatch(n -> n.toLowerCase().contains("swiggy")), "food orders must not be flagged");
            assertFalse(names.contains("Canva"), "a single yearly charge is not enough evidence");

            DetectedSubscription netflix = found.stream().filter(d -> d.getName().equals("Netflix")).findFirst().orElseThrow();
            assertEquals(17.99, netflix.getAmount());
            assertEquals(15.49, netflix.getPreviousAmount());
        }
    }
}
