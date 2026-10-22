package com.billpilot.statement;

import com.billpilot.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reads a bank/card statement CSV and returns its debit rows.
 * Column layouts differ per bank, so columns are found by header name:
 * a date column, a description column, and either a single signed amount column
 * or separate debit/withdrawal and credit/deposit columns.
 */
@Component
public class StatementParser {

    static final int MAX_ROWS = 20_000;

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("dd MMM yyyy").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("dd-MMM-yyyy").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("dd-MMM-yy").toFormatter(Locale.ENGLISH),
            DateTimeFormatter.ofPattern("dd/MM/yy")
    );

    private record Row(String date, String description, Double debit, Double signed) {
    }

    public List<Transaction> parse(InputStream in) {
        List<List<String>> rows = readCsv(in);
        if (rows.size() < 2) {
            throw new BadRequestException("The file has no transactions. Upload a CSV with a header row.");
        }

        int headerIdx = findHeaderRow(rows);
        List<String> header = rows.get(headerIdx).stream().map(h -> h.trim().toLowerCase()).toList();

        int dateCol = indexOf(header, "date");
        int descCol = indexOf(header, "description", "narration", "particulars", "details", "merchant", "memo", "payee", "remarks");
        int debitCol = indexOf(header, "debit", "withdrawal", "paid out", "money out");
        int creditCol = indexOf(header, "credit", "deposit", "paid in", "money in");
        int amountCol = indexOf(header, "amount");

        if (dateCol < 0 || descCol < 0 || (debitCol < 0 && amountCol < 0)) {
            throw new BadRequestException(
                    "Could not find the columns. The header needs a date, a description and an amount (or debit) column.");
        }

        List<Row> parsed = new ArrayList<>();
        for (int i = headerIdx + 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            String date = cell(r, dateCol);
            String desc = cell(r, descCol);
            if (date.isEmpty() || desc.isEmpty()) continue;

            Double debit = null;
            Double signed = null;
            if (debitCol >= 0) {
                Double d = parseAmount(cell(r, debitCol));
                Double c = creditCol >= 0 ? parseAmount(cell(r, creditCol)) : null;
                if (d != null && d != 0 && (c == null || c == 0)) debit = Math.abs(d);
                else if (d == null && amountCol >= 0) signed = parseAmount(cell(r, amountCol));
            } else {
                signed = parseAmount(cell(r, amountCol));
            }
            parsed.add(new Row(date, desc, debit, signed));
        }

        DateTimeFormatter fmt = pickDateFormat(parsed);
        if (fmt == null) {
            throw new BadRequestException("Could not understand the date format in this file.");
        }

        // With a single signed column, negatives are money out. If nothing is negative,
        // the bank exports debits as positive numbers, so every row counts as a debit.
        boolean hasNegatives = parsed.stream().anyMatch(r -> r.signed() != null && r.signed() < 0);

        List<Transaction> out = new ArrayList<>();
        for (Row r : parsed) {
            double amount;
            if (r.debit() != null) amount = r.debit();
            else if (r.signed() != null && r.signed() != 0) {
                if (hasNegatives && r.signed() > 0) continue;
                amount = Math.abs(r.signed());
            } else continue;

            LocalDate date = tryParse(r.date(), fmt);
            if (date != null) out.add(new Transaction(date, r.description(), amount));
        }
        return out;
    }

    private static int findHeaderRow(List<List<String>> rows) {
        // Some banks put account info above the header; use the first row that mentions "date".
        for (int i = 0; i < Math.min(rows.size(), 15); i++) {
            for (String c : rows.get(i)) {
                if (c.trim().toLowerCase().contains("date")) return i;
            }
        }
        return 0;
    }

    private static int indexOf(List<String> header, String... names) {
        for (String name : names) {
            for (int i = 0; i < header.size(); i++) {
                if (header.get(i).contains(name)) return i;
            }
        }
        return -1;
    }

    private static String cell(List<String> row, int idx) {
        return idx < row.size() ? row.get(idx).trim() : "";
    }

    static Double parseAmount(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;
        boolean negative = s.startsWith("-") || (s.startsWith("(") && s.endsWith(")")) || s.toLowerCase().endsWith("dr");
        s = s.replaceAll("[^0-9.,]", "");
        if (s.isEmpty()) return null;
        s = normalizeSeparators(s);
        try {
            double v = Double.parseDouble(s);
            return negative ? -v : v;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Rewrites a digits-and-separators string into plain "1234.56" form. Statements come in both
     * "1,234.56" (comma = thousands) and "1.234,56" / "9,99" (comma = decimal) layouts:
     * <ul>
     *   <li>when both separators appear, the one that comes last is the decimal point;</li>
     *   <li>a lone comma followed by one or two digits is a decimal comma ("9,99");</li>
     *   <li>any other comma grouping ("1,234", "1,23,456") is thousands;</li>
     *   <li>several dots ("1.234.567") are thousands separators.</li>
     * </ul>
     */
    static String normalizeSeparators(String s) {
        int lastDot = s.lastIndexOf('.');
        int lastComma = s.lastIndexOf(',');

        if (lastDot >= 0 && lastComma >= 0) {
            return lastComma > lastDot
                    ? s.replace(".", "").replace(',', '.')
                    : s.replace(",", "");
        }
        if (lastComma >= 0) {
            boolean singleComma = s.indexOf(',') == lastComma;
            int digitsAfter = s.length() - lastComma - 1;
            if (singleComma && digitsAfter >= 1 && digitsAfter <= 2) {
                return s.replace(',', '.');
            }
            return s.replace(",", "");
        }
        if (lastDot >= 0 && s.indexOf('.') != lastDot) {
            return s.replace(".", "");
        }
        return s;
    }

    private static DateTimeFormatter pickDateFormat(List<Row> rows) {
        DateTimeFormatter best = null;
        int bestCount = 0;
        for (DateTimeFormatter f : DATE_FORMATS) {
            int ok = 0;
            for (Row r : rows) if (tryParse(r.date(), f) != null) ok++;
            if (ok > bestCount) {
                best = f;
                bestCount = ok;
            }
        }
        return best;
    }

    private static LocalDate tryParse(String s, DateTimeFormatter f) {
        // Some exports append a time ("2026-01-05 10:22:00"); keep only the date part.
        String value = s.trim();
        int space = value.indexOf(' ');
        if (space > 0 && value.length() > space + 1 && Character.isDigit(value.charAt(space + 1))) {
            value = value.substring(0, space);
        }
        try {
            return LocalDate.parse(value, f);
        } catch (DateTimeParseException e) {
            try {
                return LocalDate.parse(s.trim(), f);
            } catch (DateTimeParseException e2) {
                return null;
            }
        }
    }

    /** Minimal RFC 4180 reader: quoted fields, escaped quotes, commas or semicolons or tabs as separator. */
    private static List<List<String>> readCsv(InputStream in) {
        List<List<String>> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String firstLine = null;
            char sep = ',';
            StringBuilder field = new StringBuilder();
            List<String> row = new ArrayList<>();
            boolean quoted = false;
            int c;
            boolean first = true;
            StringBuilder head = new StringBuilder();
            reader.mark(8192);
            while ((c = reader.read()) != -1 && head.length() < 4000 && c != '\n') head.append((char) c);
            reader.reset();
            firstLine = head.toString();
            sep = detectSeparator(firstLine);

            while ((c = reader.read()) != -1) {
                if (first) {
                    first = false;
                    if (c == '﻿') continue; // BOM
                }
                char ch = (char) c;
                if (quoted) {
                    if (ch == '"') {
                        reader.mark(1);
                        int next = reader.read();
                        if (next == '"') field.append('"');
                        else {
                            quoted = false;
                            if (next != -1) reader.reset();
                        }
                    } else field.append(ch);
                } else if (ch == '"') {
                    quoted = true;
                } else if (ch == sep) {
                    row.add(field.toString());
                    field.setLength(0);
                } else if (ch == '\n' || ch == '\r') {
                    if (ch == '\r') {
                        reader.mark(1);
                        int next = reader.read();
                        if (next != '\n' && next != -1) reader.reset();
                    }
                    row.add(field.toString());
                    field.setLength(0);
                    if (!(row.size() == 1 && row.get(0).isBlank())) rows.add(row);
                    row = new ArrayList<>();
                    if (rows.size() > MAX_ROWS) throw new BadRequestException("File is too large. Limit is " + MAX_ROWS + " rows.");
                } else field.append(ch);
            }
            if (field.length() > 0 || !row.isEmpty()) {
                row.add(field.toString());
                rows.add(row);
            }
        } catch (IOException e) {
            throw new BadRequestException("Could not read the uploaded file.");
        }
        return rows;
    }

    private static char detectSeparator(String line) {
        int commas = count(line, ','), semis = count(line, ';'), tabs = count(line, '\t');
        if (tabs > commas && tabs > semis) return '\t';
        return semis > commas ? ';' : ',';
    }

    private static int count(String s, char c) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) if (s.charAt(i) == c) n++;
        return n;
    }
}
