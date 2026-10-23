package com.billpilot.statement;

import com.billpilot.model.Frequency;
import com.billpilot.util.RenewalCalculator;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Synthetic benchmark: several subscriptions billed under one shared descriptor.
 * B0 = Bill Pilot's current RecurringDetector rules (one stream per descriptor, median gap).
 * B1 = description + amount + cadence grouping (cluster by amount, then the same cadence rules).
 * SP = StreamSeparator (calendar-lattice hypotheses + additive explanation).
 */
public class SeparationBenchmark {

    static final int[] TIERS = {49, 59, 79, 89, 99, 119, 129, 149, 179, 199, 249, 299, 349, 399, 499, 599, 799};
    static final String DESC = "ORBITSTORE.COM/BILL";

    record Cfg(String name, int kMin, int kMax, boolean samePrice, double nearAnchors, double batchProb,
               double oneOffPerMonth, double hikeProb, double stopProb, double missProb, double weeklyProb,
               int jitterMax, boolean batchingDescriptor) {
    }

    record Item(LocalDate date, double amount, int stream) {
    }

    static final class TrueStream {
        Frequency f;
        int anchorDay;
        LocalDate anchor;
        double latest;
        Double prev;
        int billed;
        int billedAlone;
        boolean activeAtEnd;
    }

    record Det(Frequency f, double amount, int anchorDay, LocalDate anchorDate, boolean active) {
    }

    record Statement(LocalDate start, LocalDate end, List<Transaction> charges, List<TrueStream> truth) {
    }

    // ------------------------------------------------------------------ generator

    static Statement generate(Cfg cfg, Random rnd) {
        LocalDate start = LocalDate.of(2025, 1, 1).plusDays(rnd.nextInt(60));
        LocalDate end = start.plusMonths(12).minusDays(1);
        int k = cfg.kMin + rnd.nextInt(cfg.kMax - cfg.kMin + 1);
        List<Integer> tierIdx = new ArrayList<>();
        for (int i = 0; i < TIERS.length; i++) tierIdx.add(i);
        Collections.shuffle(tierIdx, rnd);

        List<Item> items = new ArrayList<>();
        List<TrueStream> truth = new ArrayList<>();
        int firstAnchor = 1 + rnd.nextInt(31);
        for (int s = 0; s < k; s++) {
            TrueStream t = new TrueStream();
            boolean weekly = rnd.nextDouble() < cfg.weeklyProb;
            t.f = weekly ? Frequency.WEEKLY : Frequency.MONTHLY;
            int tier = cfg.samePrice ? tierIdx.get(0) : tierIdx.get(s);
            double price = TIERS[tier];
            int anchorDay;
            if (s > 0 && rnd.nextDouble() < cfg.nearAnchors) {
                anchorDay = Math.max(1, Math.min(31, firstAnchor + rnd.nextInt(7) - 3));
            } else {
                anchorDay = s == 0 ? firstAnchor : 1 + rnd.nextInt(31);
            }
            int startOffset = rnd.nextDouble() < 0.6 ? 0 : 1 + rnd.nextInt(3);
            LocalDate first;
            if (weekly) {
                first = start.plusDays(rnd.nextInt(7)).plusWeeks(startOffset);
                anchorDay = first.getDayOfMonth();
            } else {
                LocalDate base = start.withDayOfMonth(Math.min(anchorDay, start.lengthOfMonth()));
                if (base.isBefore(start)) base = RenewalCalculator.addPeriods(base, Frequency.MONTHLY, 1, anchorDay);
                first = RenewalCalculator.addPeriods(base, Frequency.MONTHLY, startOffset, anchorDay);
            }
            t.anchorDay = anchorDay;
            t.anchor = first;
            List<LocalDate> dues = new ArrayList<>();
            for (int i = 0; ; i++) {
                LocalDate d = RenewalCalculator.addPeriods(first, t.f, i, anchorDay);
                if (d.plusDays(cfg.jitterMax).isAfter(end)) break;
                dues.add(d);
            }
            int stopAt = dues.size();
            if (rnd.nextDouble() < cfg.stopProb && dues.size() > 5) {
                stopAt = 4 + rnd.nextInt(dues.size() - 5);
            }
            t.activeAtEnd = stopAt == dues.size();
            int hikeAt = -1;
            double newPrice = price;
            if (rnd.nextDouble() < cfg.hikeProb && stopAt > 5) {
                hikeAt = 2 + rnd.nextInt(stopAt - 3);
                newPrice = nextTier(price, rnd);
            }
            double lastPrice = price;
            for (int i = 0; i < stopAt; i++) {
                if (rnd.nextDouble() < cfg.missProb) continue;
                double p = (hikeAt >= 0 && i >= hikeAt) ? newPrice : price;
                LocalDate post = dues.get(i).plusDays(rnd.nextInt(cfg.jitterMax + 1));
                items.add(new Item(post, p, s));
                t.billed++;
                lastPrice = p;
            }
            t.latest = lastPrice;
            if (hikeAt >= 0 && lastPrice == newPrice) t.prev = price;
            truth.add(t);
        }
        // one-off purchases under the same descriptor
        if (cfg.oneOffPerMonth > 0) {
            long days = ChronoUnit.DAYS.between(start, end) + 1;
            int count = poisson(cfg.oneOffPerMonth * 12, rnd);
            for (int i = 0; i < count; i++) {
                LocalDate d = start.plusDays(rnd.nextInt((int) days));
                double amt = rnd.nextBoolean() ? TIERS[rnd.nextInt(TIERS.length)] : 20 + rnd.nextInt(1481);
                items.add(new Item(d, amt, -1));
            }
        }
        items.sort(Comparator.comparing(Item::date));
        // grouping: purchases within 3 days of a batch's first item may be billed as one debit
        List<List<Item>> batches = new ArrayList<>();
        boolean[] taken = new boolean[items.size()];
        for (int i = 0; i < items.size(); i++) {
            if (taken[i]) continue;
            List<Item> b = new ArrayList<>();
            b.add(items.get(i));
            taken[i] = true;
            if (cfg.batchProb > 0) {
                for (int j = i + 1; j < items.size(); j++) {
                    if (taken[j]) continue;
                    if (ChronoUnit.DAYS.between(items.get(i).date(), items.get(j).date()) > 3) break;
                    if (rnd.nextDouble() < cfg.batchProb) {
                        b.add(items.get(j));
                        taken[j] = true;
                    }
                }
            }
            batches.add(b);
        }
        List<Transaction> charges = new ArrayList<>();
        for (List<Item> b : batches) {
            LocalDate d = b.stream().map(Item::date).max(Comparator.naturalOrder()).get();
            double amt = b.stream().mapToDouble(Item::amount).sum();
            if (d.isAfter(end)) continue;
            charges.add(new Transaction(d, DESC, amt));
            if (b.size() == 1 && b.get(0).stream() >= 0) truth.get(b.get(0).stream()).billedAlone++;
        }
        return new Statement(start, end, charges, truth);
    }

    static double nextTier(double price, Random rnd) {
        List<Integer> options = new ArrayList<>();
        for (int t : TIERS) if (t > price && t <= price * 1.5) options.add(t);
        if (options.isEmpty()) return Math.round(price * 1.2);
        return options.get(rnd.nextInt(Math.min(2, options.size())));
    }

    static int poisson(double lambda, Random rnd) {
        double l = Math.exp(-lambda), p = 1;
        int k = 0;
        do {
            k++;
            p *= rnd.nextDouble();
        } while (p > l);
        return k - 1;
    }

    // ------------------------------------------------------------------ B0: current Bill Pilot rules (ported 1:1)

    enum Cadence {
        WEEKLY(Frequency.WEEKLY, 7, 1), MONTHLY(Frequency.MONTHLY, 30, 3), YEARLY(Frequency.YEARLY, 365, 7);
        final Frequency f;
        final int days, tol;

        Cadence(Frequency f, int days, int tol) {
            this.f = f;
            this.days = days;
            this.tol = tol;
        }

        boolean matches(long gap) {
            return Math.abs(gap - days) <= tol;
        }

        static Cadence classify(double g) {
            for (Cadence c : values()) if (Math.abs(g - c.days) <= c.tol) return c;
            return null;
        }
    }

    static Det b0(List<Transaction> group, boolean known) {
        List<Transaction> txns = new ArrayList<>(group.stream().sorted(Comparator.comparing(Transaction::date))
                .collect(Collectors.toMap(Transaction::date, t -> t, (a, b) -> b, LinkedHashMap::new)).values());
        int minOcc = known ? 2 : 3;
        if (txns.size() < minOcc) return null;
        List<Long> gaps = new ArrayList<>();
        for (int i = 1; i < txns.size(); i++) gaps.add(ChronoUnit.DAYS.between(txns.get(i - 1).date(), txns.get(i).date()));
        double medianGap = median(gaps.stream().map(Long::doubleValue).toList());
        Cadence cadence = Cadence.classify(medianGap);
        if (cadence == null) return null;
        if (!known && cadence == Cadence.WEEKLY) return null;
        long on = gaps.stream().filter(cadence::matches).count();
        double regularity = (double) on / gaps.size();
        if (regularity < 0.6) return null;
        List<Double> amounts = txns.stream().map(Transaction::amount).toList();
        double med = median(amounts);
        double spread = (Collections.max(amounts) - Collections.min(amounts)) / med;
        if (spread > (known ? 0.5 : 0.05)) return null;
        double stability = Math.max(0, 1 - spread);
        double conf = 100 * (0.35 * regularity + 0.25 * stability + 0.20 * Math.min(1.0, txns.size() / 4.0) + (known ? 0.20 : 0.0));
        if (Math.round(conf) < 50) return null;
        Transaction last = txns.get(txns.size() - 1);
        return new Det(cadence.f, last.amount(), last.date().getDayOfMonth(), last.date(), true);
    }

    static double median(List<Double> v) {
        List<Double> s = v.stream().sorted().toList();
        int n = s.size();
        return n % 2 == 1 ? s.get(n / 2) : (s.get(n / 2 - 1) + s.get(n / 2)) / 2.0;
    }

    // ------------------------------------------------------------------ B1: description + amount + cadence grouping

    static List<Det> b1(List<Transaction> group) {
        List<Transaction> byAmount = group.stream().sorted(Comparator.comparingDouble(Transaction::amount)).toList();
        List<List<Transaction>> clusters = new ArrayList<>();
        for (Transaction t : byAmount) {
            if (!clusters.isEmpty()) {
                List<Transaction> c = clusters.get(clusters.size() - 1);
                if (Math.abs(t.amount() - c.get(0).amount()) <= Math.max(0.01, 0.01 * c.get(0).amount())) {
                    c.add(t);
                    continue;
                }
            }
            clusters.add(new ArrayList<>(List.of(t)));
        }
        List<Det> out = new ArrayList<>();
        for (List<Transaction> c : clusters) {
            Det d = b0(c, false);
            if (d != null) out.add(d);
        }
        return out;
    }

    // ------------------------------------------------------------------ SP: the separator

    static List<Det> sp(Statement st, boolean allowCombined) {
        StreamSeparator.Result r = new StreamSeparator().separate(st.charges(), st.start(), st.end(), allowCombined);
        List<Det> out = new ArrayList<>();
        for (StreamSeparator.Stream s : r.streams()) {
            out.add(new Det(s.frequency(), s.amount(), s.anchorDay(), s.firstSeen(), !s.stopped()));
        }
        return out;
    }

    // ------------------------------------------------------------------ scoring

    static final class Tally {
        long tp, fn, fp, exact, n, detectable;
        double absErr, relErrSum;
        long relN;
        long nanos;
    }

    static int minHits(Frequency f) {
        return f == Frequency.WEEKLY ? 4 : 3;
    }

    static boolean amountMatch(double a, TrueStream t) {
        return close(a, t.latest) || (t.prev != null && close(a, t.prev));
    }

    static boolean close(double a, double b) {
        return Math.abs(a - b) <= Math.max(0.01, 0.01 * Math.max(a, b));
    }

    static boolean anchorMatch(Det d, TrueStream t) {
        if (t.f == Frequency.WEEKLY) {
            int a = d.anchorDate().getDayOfWeek().getValue(), b = t.anchor.getDayOfWeek().getValue();
            int diff = Math.abs(a - b);
            return Math.min(diff, 7 - diff) <= 3;
        }
        int diff = Math.abs(d.anchorDay() - t.anchorDay);
        return Math.min(diff, 31 - diff) <= 3;
    }

    static int anchorDiff(Det d, TrueStream t) {
        if (t.f == Frequency.WEEKLY) {
            int diff = Math.abs(d.anchorDate().getDayOfWeek().getValue() - t.anchor.getDayOfWeek().getValue());
            return Math.min(diff, 7 - diff);
        }
        int diff = Math.abs(d.anchorDay() - t.anchorDay);
        return Math.min(diff, 31 - diff);
    }

    static double monthly(double amount, Frequency f) {
        return switch (f) {
            case DAILY -> amount * 365.0 / 12;
            case WEEKLY -> amount * 52.0 / 12;
            case MONTHLY -> amount;
            case YEARLY -> amount / 12;
        };
    }

    static void score(Statement st, List<Det> dets, Tally t) {
        t.n++;
        // optimal-ish one-to-one matching: closest anchors first
        List<int[]> pairs = new ArrayList<>();
        for (int ti = 0; ti < st.truth().size(); ti++) {
            TrueStream ts = st.truth().get(ti);
            for (int i = 0; i < dets.size(); i++) {
                Det d = dets.get(i);
                if (d.f() == ts.f && amountMatch(d.amount(), ts) && anchorMatch(d, ts)) pairs.add(new int[]{anchorDiff(d, ts), ti, i});
            }
        }
        pairs.sort(Comparator.comparingInt(x -> x[0]));
        boolean[] used = new boolean[dets.size()];
        boolean[] matched = new boolean[st.truth().size()];
        for (int[] pr : pairs) {
            if (matched[pr[1]] || used[pr[2]]) continue;
            matched[pr[1]] = true;
            used[pr[2]] = true;
        }
        int fn = 0, tp = 0;
        for (int ti = 0; ti < st.truth().size(); ti++) {
            TrueStream ts = st.truth().get(ti);
            if (ts.billed >= minHits(ts.f)) {
                t.detectable++;
                if (matched[ti]) tp++;
                else fn++;
            }
        }
        int fp = 0;
        for (boolean u : used) if (!u) fp++;
        t.tp += tp;
        t.fn += fn;
        t.fp += fp;
        if (fn == 0 && fp == 0) t.exact++;
        double trueMonthly = st.truth().stream().filter(s -> s.activeAtEnd).mapToDouble(s -> monthly(s.latest, s.f)).sum();
        double detMonthly = dets.stream().filter(Det::active).mapToDouble(d -> monthly(d.amount(), d.f())).sum();
        t.absErr += Math.abs(trueMonthly - detMonthly);
        if (trueMonthly > 0) {
            t.relErrSum += Math.abs(trueMonthly - detMonthly) / trueMonthly;
            t.relN++;
        }
    }

    static String row(String method, Tally t) {
        double recall = (double) t.tp / Math.max(1, t.tp + t.fn);
        double precision = (double) t.tp / Math.max(1, t.tp + t.fp);
        return String.format(Locale.ROOT, "%-3s recall=%.3f precision=%.3f exact=%.3f spendErr=%.1f relErr=%.3f tp=%d fn=%d fp=%d detectable=%d",
                method, recall, precision, (double) t.exact / t.n, t.absErr / t.n, t.relErrSum / Math.max(1, t.relN), t.tp, t.fn, t.fp, t.detectable);
    }

    public static void main(String[] args) {
        int n = args.length > 0 ? Integer.parseInt(args[0]) : 2000;
        List<Cfg> cfgs = List.of(
                new Cfg("S0 single stream (control)", 1, 1, false, 0, 0, 0, 0, 0, 0, 0, 2, true),
                new Cfg("S1 interleaved, distinct prices", 2, 4, false, 0, 0, 0, 0, 0, 0, 0, 2, true),
                new Cfg("S2 interleaved, equal prices", 2, 3, true, 0, 0, 0, 0, 0, 0, 0, 2, true),
                new Cfg("S3 grouped (combined) debits", 2, 4, false, 0.6, 0.4, 0, 0, 0, 0, 0, 2, true),
                new Cfg("S4 one-off purchases mixed in", 1, 2, false, 0, 0, 3.0, 0, 0, 0, 0, 2, false),
                new Cfg("S5 price changes, stops, misses", 2, 3, false, 0, 0, 0, 0.5, 0.3, 0.05, 0, 2, true),
                new Cfg("S6 realistic mix", 1, 4, false, 0.4, 0.3, 1.0, 0.2, 0.2, 0.03, 0.05, 3, true)
        );
        for (Cfg cfg : cfgs) {
            Random rnd = new Random(cfg.name().hashCode() * 31L + 7);
            Tally t0 = new Tally(), t1 = new Tally(), t2 = new Tally(), t3 = new Tally();
            long aloneShort = 0, streams = 0;
            int maxCharges = 0;
            for (int i = 0; i < n; i++) {
                Statement st = generate(cfg, rnd);
                maxCharges = Math.max(maxCharges, st.charges().size());
                for (TrueStream ts : st.truth()) {
                    if (ts.billed >= minHits(ts.f)) {
                        streams++;
                        if (ts.billedAlone < 2) aloneShort++;
                    }
                }
                Det d0 = b0(st.charges(), cfg.batchingDescriptor());
                score(st, d0 == null ? List.of() : List.of(d0), t0);
                score(st, b1(st.charges()), t1);
                long s = System.nanoTime();
                List<Det> d2 = sp(st, cfg.batchingDescriptor());
                t2.nanos += System.nanoTime() - s;
                score(st, d2, t2);
                if (cfg.batchingDescriptor()) score(st, sp(st, false), t3);
            }
            System.out.println("== " + cfg.name() + "  (N=" + n + " statements, detectable streams=" + streams
                    + ", billed alone <2x: " + aloneShort + ", max charges/statement=" + maxCharges + ")");
            System.out.println("  " + row("B0", t0));
            System.out.println("  " + row("B1", t1));
            System.out.println("  " + row("SP", t2) + String.format(Locale.ROOT, "  avgMs=%.2f", t2.nanos / 1e6 / n));
            if (cfg.batchingDescriptor()) System.out.println("  " + row("SPx", t3) + "   (ablation: grouped-debit closure off)");
        }
    }
}
