package com.billpilot.statement;

import com.billpilot.model.Frequency;
import com.billpilot.util.RenewalCalculator;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Separates several recurring charge streams billed under ONE statement descriptor (an app store,
 * a wallet, a marketplace, a payment gateway). The streams may be interleaved, may share a price,
 * may be grouped into one debit, may change price, and may be mixed with one-off purchases.
 *
 * <p>Plain rules, no ML. Five stages:
 * <ol>
 *   <li><b>Lattice hypotheses.</b> Every pair of charges with equal remaining amounts whose dates sit one
 *       to three billing periods apart proposes a calendar lattice (cadence, anchor date, amount). Months
 *       are calendar months with the billing day kept (Jan 31, Feb 28, Mar 31 ...).</li>
 *   <li><b>Direct-hit selection.</b> Each lattice point claims the nearest charge within +/- 3 days whose
 *       remaining amount equals the lattice amount. A point with no equal charge but a larger one nearby is
 *       <i>pending</i> (it may be grouped with other purchases); a point with neither is a <i>miss</i>.
 *       A lattice whose amount is the sum of two or three smaller lattices due near every one of its
 *       charges is skipped: it is a recurring grouped debit, not a subscription. The best remaining lattice
 *       is accepted, its charges are consumed, and hypotheses are rebuilt from what is left. Repeat until no
 *       lattice qualifies.</li>
 *   <li><b>Price continuity.</b> Two accepted lattices that follow each other on the same calendar
 *       lattice, or a run of two or more equal charges continuing a lattice at a different price (within
 *       50%), are one stream that changed price.</li>
 *   <li><b>Additive closure.</b> A remaining charge is explained as a grouped debit only when it equals,
 *       within half a percent, the sum of the amounts of two or more streams whose pending points fall within
 *       +/- 3 days of it. Inside a stream's active span, a pending point may also take its share from a
 *       larger nearby charge that also contains other purchases.</li>
 *   <li><b>Status.</b> A stream whose last two due dates passed with no charge is reported as stopped; one
 *       passed due date with no charge is reported as overdue (a failed or delayed payment, or a cancellation).</li>
 * </ol>
 * Whatever remains unexplained is reported as one-off purchases.
 */
public class StreamSeparator {

    /** A charge may post up to this many days before or after its due date. */
    static final int WINDOW_DAYS = 3;
    /** Largest relative price change accepted as the same stream. */
    static final double PRICE_CHANGE_LIMIT = 0.5;
    /** Share of lattice points inside a stream's active span that may be missing. */
    static final double MAX_MISS_SHARE = 0.25;
    /** Largest number of streams tried when splitting one grouped debit. */
    static final int MAX_GROUP_SIZE = 4;
    static final int MIN_CONFIDENCE = 50;

    public record Hit(LocalDate due, int chargeIndex, LocalDate chargeDate, double share, boolean combined) {
    }

    public record Stream(Frequency frequency, int anchorDay, double amount, Double previousAmount,
                         LocalDate priceChangedOn, List<Hit> hits, int expected, int misses, int directHits,
                         int combinedHits, LocalDate firstSeen, LocalDate lastSeen, LocalDate nextExpected,
                         boolean stopped, boolean overdue, int confidence) {
        public int occurrences() {
            return hits.size();
        }
    }

    /** The part of a charge that no stream explains. */
    public record Leftover(LocalDate date, String description, double amount) {
    }

    public record Result(List<Stream> streams, List<Leftover> unexplained) {
    }

    private record Hypothesis(Frequency frequency, LocalDate anchor, int anchorDay, double amount) {
    }

    /** Working state of one lattice. */
    private final class Lattice {
        final Frequency frequency;
        final LocalDate anchor;
        final int anchorDay;
        final List<LocalDate> points;
        double amount;
        Double previousAmount;
        LocalDate priceChangedOn;
        final List<Hit> hits = new ArrayList<>();
        int pending;

        Lattice(Hypothesis h) {
            this.frequency = h.frequency();
            this.anchor = h.anchor();
            this.anchorDay = h.anchorDay();
            this.amount = h.amount();
            this.points = points(frequency, anchor, anchorDay);
        }

        int direct() {
            return (int) hits.stream().filter(x -> !x.combined()).count();
        }

        LocalDate firstDue() {
            return hits.stream().map(Hit::due).min(Comparator.naturalOrder()).orElseThrow();
        }

        LocalDate lastDue() {
            return hits.stream().map(Hit::due).max(Comparator.naturalOrder()).orElseThrow();
        }

        boolean hasHitAt(LocalDate due) {
            return hits.stream().anyMatch(x -> x.due().equals(due));
        }

        /** Lattice points from the first to the last hit, inclusive. */
        int expected() {
            LocalDate a = firstDue(), b = lastDue();
            return (int) points.stream().filter(d -> !d.isBefore(a) && !d.isAfter(b)).count();
        }
    }

    private LocalDate[] date;
    private double[] amount;
    private double[] residual;
    private String[] description;
    private LocalDate spanStart;
    private LocalDate spanEnd;
    private boolean allowCombined;

    /**
     * @param charges       debits that share one descriptor (any order)
     * @param spanStart     first day covered by the statement
     * @param spanEnd       last day covered by the statement
     * @param allowCombined true when this descriptor may group several purchases into one debit
     */
    public synchronized Result separate(List<Transaction> charges, LocalDate spanStart, LocalDate spanEnd,
                                        boolean allowCombined) {
        List<Transaction> sorted = charges.stream()
                .sorted(Comparator.comparing(Transaction::date).thenComparingDouble(Transaction::amount))
                .toList();
        int n = sorted.size();
        date = new LocalDate[n];
        amount = new double[n];
        residual = new double[n];
        description = new String[n];
        for (int i = 0; i < n; i++) {
            date[i] = sorted.get(i).date();
            amount[i] = sorted.get(i).amount();
            residual[i] = amount[i];
            description[i] = sorted.get(i).description();
        }
        this.spanStart = spanStart;
        this.spanEnd = spanEnd;
        this.allowCombined = allowCombined;

        // 1-4, repeated: grouped debits that are split in stage 4 leave remainders that can reveal more streams
        List<Lattice> streams = new ArrayList<>();
        int before;
        do {
            before = streams.size();
            selectLattices(streams);
            mergePriceChanges(streams);
            for (Lattice l : streams) extend(l, streams);
            if (allowCombined) {
                closeGroupedDebits(streams);
                for (Lattice l : streams) fillInternalGaps(l);
            }
        } while (streams.size() > before);

        // 5: status and output
        List<Stream> out = new ArrayList<>();
        for (Lattice l : streams) {
            Stream s = toStream(l);
            if (s.confidence() >= MIN_CONFIDENCE) out.add(s);
            else for (Hit h : l.hits) residual[h.chargeIndex()] += h.share();
        }
        out.sort(Comparator.comparing(Stream::anchorDay).thenComparing(Stream::amount));

        List<Leftover> leftovers = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (residual[i] > tol(amount[i])) leftovers.add(new Leftover(date[i], description[i], round(residual[i])));
        }
        return new Result(out, leftovers);
    }

    // ------------------------------------------------------------------ 1. hypotheses

    private List<Hypothesis> hypotheses() {
        int n = date.length;
        Set<String> seen = new HashSet<>();
        List<Hypothesis> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (!open(i)) continue;
            for (int j = i + 1; j < n; j++) {
                if (!open(j)) continue;
                long days = ChronoUnit.DAYS.between(date[i], date[j]);
                if (days > 3 * 366 + WINDOW_DAYS) break;
                if (!same(residual[i], residual[j])) continue;
                double p = residual[i];
                int day = date[i].getDayOfMonth();
                long w = Math.round(days / 7.0);
                if (w >= 1 && w <= 3 && Math.abs(days - 7 * w) <= 1) {
                    add(out, seen, new Hypothesis(Frequency.WEEKLY, date[i], day, p));
                }
                for (int m = 1; m <= 3; m++) {
                    if (near(RenewalCalculator.addPeriods(date[i], Frequency.MONTHLY, m, day), date[j])) {
                        add(out, seen, new Hypothesis(Frequency.MONTHLY, date[i], day, p));
                    }
                }
                for (int y = 1; y <= 2; y++) {
                    if (near(RenewalCalculator.addPeriods(date[i], Frequency.YEARLY, y, day), date[j])) {
                        add(out, seen, new Hypothesis(Frequency.YEARLY, date[i], day, p));
                    }
                }
            }
        }
        return out;
    }

    private static void add(List<Hypothesis> out, Set<String> seen, Hypothesis h) {
        if (seen.add(h.frequency() + "|" + h.anchor() + "|" + Math.round(h.amount() * 100))) out.add(h);
    }

    // ------------------------------------------------------------------ 2. lattice evaluation

    /** Due dates of a lattice that fall inside the statement span (plus the posting window). */
    private List<LocalDate> points(Frequency f, LocalDate anchor, int anchorDay) {
        List<LocalDate> pts = new ArrayList<>();
        LocalDate from = spanStart.minusDays(WINDOW_DAYS);
        LocalDate to = spanEnd.plusDays(WINDOW_DAYS);
        long k = 0;
        while (!due(f, anchor, k - 1, anchorDay).isBefore(from)) k--;
        for (; ; k++) {
            LocalDate d = due(f, anchor, k, anchorDay);
            if (d.isAfter(to)) break;
            if (!d.isBefore(from)) pts.add(d);
        }
        return pts;
    }

    private static LocalDate due(Frequency f, LocalDate anchor, long k, int anchorDay) {
        return RenewalCalculator.addPeriods(anchor, f, k, anchorDay);
    }

    private Lattice evaluate(Hypothesis h) {
        Lattice l = new Lattice(h);
        boolean[] used = new boolean[date.length];
        List<LocalDate> pendingDues = new ArrayList<>();
        for (LocalDate d : l.points) {
            int c = nearest(d, used, r -> same(r, h.amount()));
            if (c >= 0) {
                used[c] = true;
                l.hits.add(new Hit(d, c, date[c], h.amount(), false));
            } else if (allowCombined && nearest(d, used, r -> r > h.amount() + tol(h.amount())) >= 0) {
                pendingDues.add(d);
            }
        }
        if (l.hits.isEmpty()) return null;
        LocalDate a = l.firstDue(), b = l.lastDue();
        l.pending = (int) pendingDues.stream().filter(d -> !d.isBefore(a) && !d.isAfter(b)).count();
        return l;
    }

    private interface AmountTest {
        boolean ok(double residual);
    }

    /** Nearest open charge within the posting window of {@code due} whose remaining amount passes the test. */
    private int nearest(LocalDate due, boolean[] used, AmountTest test) {
        int best = -1;
        long bestDist = Long.MAX_VALUE;
        for (int c = 0; c < date.length; c++) {
            if ((used != null && used[c]) || !open(c)) continue;
            long dist = Math.abs(ChronoUnit.DAYS.between(due, date[c]));
            if (dist <= WINDOW_DAYS && dist < bestDist && test.ok(residual[c])) {
                best = c;
                bestDist = dist;
            }
        }
        return best;
    }

    private static int minHits(Frequency f) {
        return switch (f) {
            case WEEKLY -> 4;
            case YEARLY -> 2;
            default -> 3;
        };
    }

    private boolean acceptable(Lattice l) {
        int direct = l.direct();
        int exp = l.expected();
        int misses = exp - direct - l.pending;
        return direct >= 2
                && direct + l.pending >= minHits(l.frequency)
                && misses <= Math.floor(MAX_MISS_SHARE * exp);
    }

    private double score(Lattice l) {
        int misses = l.expected() - l.direct() - l.pending;
        return l.direct() + 0.5 * l.pending - misses;
    }

    /** Deterministic tie-break: more direct hits, then the larger amount, then the earlier anchor. */
    private static int tieBreak(Lattice a, Lattice b) {
        if (a.direct() != b.direct()) return Integer.compare(b.direct(), a.direct());
        if (Math.abs(a.amount - b.amount) > 1e-9) return Double.compare(b.amount, a.amount);
        return a.anchor.compareTo(b.anchor);
    }

    /** Stage 2: greedily accepts the best lattice that is not just the sum of other lattices, consuming its charges. */
    private void selectLattices(List<Lattice> streams) {
        while (true) {
            List<Lattice> candidates = new ArrayList<>();
            for (Hypothesis h : hypotheses()) {
                Lattice l = evaluate(h);
                if (l != null && acceptable(l)) candidates.add(l);
            }
            Lattice best = null;
            double bestScore = Double.NEGATIVE_INFINITY;
            for (Lattice l : candidates) {
                if (allowCombined && isComposite(l, candidates, streams)) continue;
                double s = score(l);
                if (best == null || s > bestScore + 1e-9 || (Math.abs(s - bestScore) <= 1e-9 && tieBreak(l, best) < 0)) {
                    best = l;
                    bestScore = s;
                }
            }
            if (best == null) return;
            for (Hit h : best.hits) consume(h.chargeIndex(), h.share());
            streams.add(best);
        }
    }

    /**
     * True when a lattice's amount is the sum of two or three smaller lattices that are due near every one of
     * its charges: a recurring grouped debit, not a subscription of its own.
     */
    private boolean isComposite(Lattice l, List<Lattice> candidates, List<Lattice> accepted) {
        List<Lattice> pool = new ArrayList<>();
        for (Lattice c : candidates) if (c != l && c.amount < l.amount - tol(l.amount)) pool.add(c);
        for (Lattice c : accepted) if (c.amount < l.amount - tol(l.amount)) pool.add(c);
        int m = pool.size();
        for (int a = 0; a < m; a++) {
            for (int b = a + 1; b < m; b++) {
                double ab = pool.get(a).amount + pool.get(b).amount;
                if (same(ab, l.amount) && covers(l, List.of(pool.get(a), pool.get(b)))) return true;
                if (ab >= l.amount) continue;
                for (int c = b + 1; c < m; c++) {
                    if (same(ab + pool.get(c).amount, l.amount) && covers(l, List.of(pool.get(a), pool.get(b), pool.get(c)))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** Every part has a lattice point within the posting window of every charge of {@code whole}. */
    private boolean covers(Lattice whole, List<Lattice> parts) {
        for (Lattice p : parts) {
            if (p.anchor.equals(whole.anchor) && same(p.amount, whole.amount)) return false;
        }
        for (Hit h : whole.hits) {
            for (Lattice p : parts) {
                if (p.points.stream().noneMatch(d -> near(d, h.chargeDate()))) return false;
            }
        }
        return true;
    }

    // ------------------------------------------------------------------ 3. price continuity

    /** Joins two accepted lattices whose spans follow each other on the same calendar lattice at different prices. */
    private void mergePriceChanges(List<Lattice> streams) {
        boolean merged = true;
        while (merged) {
            merged = false;
            outer:
            for (Lattice a : streams) {
                for (Lattice b : streams) {
                    if (a == b || a.frequency != b.frequency) continue;
                    LocalDate aLast = a.lastDue();
                    LocalDate bFirstCharge = b.hits.stream().map(Hit::chargeDate).min(Comparator.naturalOrder()).orElseThrow();
                    if (!bFirstCharge.isAfter(aLast)) continue;
                    if (Math.abs(b.amount - a.amount) / a.amount > PRICE_CHANGE_LIMIT) continue;
                    // b must start at a's next lattice point, or the one after it (one missed payment in between)
                    List<LocalDate> nextTwo = a.points.stream().filter(d -> d.isAfter(aLast)).limit(2).toList();
                    if (nextTwo.stream().noneMatch(d -> near(d, bFirstCharge))) continue;
                    this.others = streams;
                    if (groupedWithOther(a, b.amount, b.hits)) continue;
                    for (Hit h : b.hits) a.hits.add(new Hit(nearestPoint(a, h.chargeDate()), h.chargeIndex(), h.chargeDate(), h.share(), h.combined()));
                    if (!same(a.amount, b.amount)) {
                        a.previousAmount = a.amount;
                        a.amount = b.amount;
                        a.priceChangedOn = bFirstCharge;
                    }
                    streams.remove(b);
                    merged = true;
                    break outer;
                }
            }
        }
    }

    /** Continues a lattice over two or more consecutive equal charges at a changed price (forward, then backward). */
    private void extend(Lattice l, List<Lattice> streams) {
        this.others = streams;
        LocalDate last = l.lastDue();
        List<Hit> run = new ArrayList<>();
        double q = Double.NaN;
        int gap = 0;
        for (LocalDate d : l.points) {
            if (!d.isAfter(last)) continue;
            Hit h = claimChanged(d, l.amount, q);
            if (h == null) {
                if (++gap > 1) break;
                continue;
            }
            gap = 0;
            q = h.share();
            run.add(h);
        }
        if (run.size() >= 2 && !groupedWithOther(l, q, run)) {
            for (Hit h : run) {
                consume(h.chargeIndex(), h.share());
                l.hits.add(h);
            }
            l.previousAmount = l.amount;
            l.amount = q;
            l.priceChangedOn = run.get(0).chargeDate();
        }
        LocalDate first = l.firstDue();
        double base = l.hits.stream().min(Comparator.comparing(Hit::due)).orElseThrow().share();
        List<Hit> back = new ArrayList<>();
        double r = Double.NaN;
        int backGap = 0;
        for (int i = l.points.size() - 1; i >= 0; i--) {
            LocalDate d = l.points.get(i);
            if (!d.isBefore(first)) continue;
            Hit h = claimChanged(d, base, r);
            if (h == null) {
                if (++backGap > 1) break;
                continue;
            }
            backGap = 0;
            r = h.share();
            back.add(0, h);
        }
        if (back.size() >= 2 && !groupedWithOther(l, r, back)) {
            LocalDate firstAtCurrentPrice = l.hits.stream().map(Hit::chargeDate).min(Comparator.naturalOrder()).orElseThrow();
            for (Hit h : back) {
                consume(h.chargeIndex(), h.share());
                l.hits.add(h);
            }
            if (l.previousAmount == null) {
                l.previousAmount = r;
                l.priceChangedOn = firstAtCurrentPrice;
            }
        }
    }

    private List<Lattice> others = List.of();

    /**
     * True when a "new price" is really this stream grouped with another accepted stream: the difference equals
     * the other stream's amount and the other stream is due near every one of those charges.
     */
    private boolean groupedWithOther(Lattice l, double newAmount, List<Hit> run) {
        if (!allowCombined) return false;
        double diff = Math.abs(newAmount - l.amount);
        for (Lattice o : others) {
            if (o == l || !same(o.amount, diff)) continue;
            boolean due = run.stream().allMatch(h -> o.points.stream().anyMatch(d -> near(d, h.chargeDate())));
            if (due) return true;
        }
        return false;
    }

    private Hit claimChanged(LocalDate due, double base, double q) {
        int c = nearest(due, null, r -> !same(r, base)
                && Math.abs(r - base) / base <= PRICE_CHANGE_LIMIT
                && (Double.isNaN(q) || same(r, q)));
        return c < 0 ? null : new Hit(due, c, date[c], residual[c], false);
    }

    // ------------------------------------------------------------------ 4. additive closure

    private record Slot(Lattice stream, LocalDate due) {
    }

    /** Explains a remaining charge as the exact sum of two or more streams due within the posting window. */
    private void closeGroupedDebits(List<Lattice> streams) {
        for (int c = 0; c < date.length; c++) {
            if (!open(c)) continue;
            List<Slot> slots = new ArrayList<>();
            for (Lattice l : streams) {
                for (LocalDate d : l.points) {
                    if (near(d, date[c]) && !l.hasHitAt(d)) {
                        slots.add(new Slot(l, d));
                        break;
                    }
                }
            }
            List<Slot> bestSet = null;
            long bestDist = Long.MAX_VALUE;
            int m = slots.size();
            for (int mask = 1; mask < (1 << m); mask++) {
                int size = Integer.bitCount(mask);
                if (size < 2 || size > MAX_GROUP_SIZE) continue;
                double sum = 0;
                long dist = 0;
                List<Slot> set = new ArrayList<>();
                for (int b = 0; b < m; b++) {
                    if ((mask & (1 << b)) != 0) {
                        sum += slots.get(b).stream().amount;
                        dist += Math.abs(ChronoUnit.DAYS.between(slots.get(b).due(), date[c]));
                        set.add(slots.get(b));
                    }
                }
                if (!same(sum, residual[c])) continue;
                if (bestSet == null || set.size() < bestSet.size() || (set.size() == bestSet.size() && dist < bestDist)) {
                    bestSet = set;
                    bestDist = dist;
                }
            }
            if (bestSet != null) {
                for (Slot s : bestSet) {
                    s.stream().hits.add(new Hit(s.due(), c, date[c], s.stream().amount, true));
                    consume(c, s.stream().amount);
                }
            }
        }
    }

    /** Inside a stream's active span, a point with no hit takes its share from a larger nearby charge. */
    private void fillInternalGaps(Lattice l) {
        LocalDate a = l.firstDue(), b = l.lastDue();
        for (LocalDate d : l.points) {
            if (d.isBefore(a) || d.isAfter(b) || l.hasHitAt(d)) continue;
            int c = nearest(d, null, r -> r > l.amount + tol(l.amount));
            if (c >= 0) {
                l.hits.add(new Hit(d, c, date[c], l.amount, true));
                consume(c, l.amount);
            }
        }
    }

    // ------------------------------------------------------------------ 5. output

    private Stream toStream(Lattice l) {
        l.hits.sort(Comparator.comparing(Hit::due));
        int exp = l.expected();
        int hits = l.hits.size();
        int misses = Math.max(0, exp - hits);
        LocalDate lastDue = l.lastDue();
        // due dates after the last charge that have already passed (beyond the posting window) with no charge
        List<LocalDate> passed = l.points.stream()
                .filter(d -> d.isAfter(lastDue) && d.plusDays(WINDOW_DAYS).isBefore(spanEnd)).toList();
        boolean stopped = passed.size() >= 2;
        boolean overdue = passed.size() == 1;
        LocalDate next = l.points.stream().filter(d -> d.isAfter(lastDue)).findFirst()
                .orElse(due(l.frequency, lastDue, 1, l.anchorDay));
        int day = modeDay(l);
        if (l.frequency != Frequency.WEEKLY && Math.abs(day - next.getDayOfMonth()) <= WINDOW_DAYS) {
            next = next.withDayOfMonth(Math.min(day, next.lengthOfMonth()));
        }
        int direct = l.direct();
        double confidence = 100 * (0.40 * ((double) hits / exp)
                + 0.25 * Math.min(1.0, hits / 6.0)
                + 0.20 * ((double) direct / hits)
                + 0.15 * (stopped ? 0.0 : 1.0));
        return new Stream(l.frequency, day, round(l.amount),
                l.previousAmount == null ? null : round(l.previousAmount), l.priceChangedOn,
                List.copyOf(l.hits), exp, misses, direct, hits - direct,
                l.hits.get(0).chargeDate(), l.hits.get(hits - 1).chargeDate(), stopped ? null : next, stopped, overdue,
                (int) Math.round(confidence));
    }

    /**
     * The billing day: the lattice day shifted by the earliest posting offset, since charges post on or a few
     * days after their due date.
     */
    private static int modeDay(Lattice l) {
        long minOffset = l.hits.stream().mapToLong(h -> ChronoUnit.DAYS.between(h.due(), h.chargeDate())).min().orElse(0);
        int day = l.frequency == Frequency.WEEKLY ? l.hits.get(0).due().plusDays(minOffset).getDayOfMonth() : l.anchorDay;
        if (l.frequency != Frequency.WEEKLY) day = (int) Math.floorMod(day - 1 + minOffset, 31) + 1;
        return day;
    }

    private LocalDate nearestPoint(Lattice l, LocalDate d) {
        return l.points.stream().min(Comparator.comparingLong(p -> Math.abs(ChronoUnit.DAYS.between(p, d)))).orElse(d);
    }

    // ------------------------------------------------------------------ helpers

    private boolean open(int c) {
        return residual[c] > tol(amount[c]);
    }

    private void consume(int c, double share) {
        residual[c] -= share;
        if (Math.abs(residual[c]) <= tol(amount[c])) residual[c] = 0;
    }

    private static boolean near(LocalDate a, LocalDate b) {
        return Math.abs(ChronoUnit.DAYS.between(a, b)) <= WINDOW_DAYS;
    }

    static double tol(double v) {
        return Math.max(0.01, Math.abs(v) * 0.005);
    }

    static boolean same(double a, double b) {
        return Math.abs(a - b) <= tol(Math.max(a, b));
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
