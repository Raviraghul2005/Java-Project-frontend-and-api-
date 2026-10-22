package com.billpilot.filter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String AUTH_PATH_PREFIX = "/api/v1/auth/";
    private static final long MAX_TRACKED_CLIENTS = 100_000;

    private final Cache<String, Bucket> generalBuckets = newBucketCache();
    private final Cache<String, Bucket> authBuckets = newBucketCache();

    private final long capacity;
    private final long refillTokens;
    private final long refillDurationSeconds;
    private final long authCapacity;
    private final long authRefillTokens;
    private final long authRefillDurationSeconds;
    private final boolean trustForwardedFor;

    public RateLimitFilter(long capacity, long refillTokens, long refillDurationSeconds) {
        this(capacity, refillTokens, refillDurationSeconds, 10, 5, 60, false);
    }

    @Autowired
    public RateLimitFilter(
            @Value("${app.rate-limit.capacity:100}") long capacity,
            @Value("${app.rate-limit.refill-tokens:20}") long refillTokens,
            @Value("${app.rate-limit.refill-duration-seconds:10}") long refillDurationSeconds,
            @Value("${app.rate-limit.auth-capacity:10}") long authCapacity,
            @Value("${app.rate-limit.auth-refill-tokens:5}") long authRefillTokens,
            @Value("${app.rate-limit.auth-refill-duration-seconds:60}") long authRefillDurationSeconds,
            @Value("${app.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor) {
        this.capacity = capacity;
        this.refillTokens = refillTokens;
        this.refillDurationSeconds = refillDurationSeconds;
        this.authCapacity = authCapacity;
        this.authRefillTokens = authRefillTokens;
        this.authRefillDurationSeconds = authRefillDurationSeconds;
        this.trustForwardedFor = trustForwardedFor;
    }

    private static Cache<String, Bucket> newBucketCache() {
        // Bounded + expiring so a flood of distinct client addresses cannot exhaust memory.
        return Caffeine.newBuilder()
                .maximumSize(MAX_TRACKED_CLIENTS)
                .expireAfterAccess(Duration.ofMinutes(15))
                .build();
    }

    private static Bucket newBucket(long capacity, long refillTokens, long refillSeconds) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(refillTokens, Duration.ofSeconds(refillSeconds))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // Only rate-limit API endpoints; static files and the root page are not throttled.
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String clientIp = getClientIP(request);
        boolean authRoute = request.getRequestURI().startsWith(AUTH_PATH_PREFIX);

        Bucket bucket = authRoute
                ? authBuckets.get(clientIp, k -> newBucket(authCapacity, authRefillTokens, authRefillDurationSeconds))
                : generalBuckets.get(clientIp, k -> newBucket(capacity, refillTokens, refillDurationSeconds));

        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            filterChain.doFilter(request, response);
        } else {
            long retryAfterSeconds = Math.max(1, Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds() + 1);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setContentType("application/json");
            response.getWriter().write("{\"success\":false,\"error\":\"Rate Limit exceeded\",\"message\":\"Rate Limit exceeded\"}");
        }
    }

    /**
     * X-Forwarded-For is client-controlled unless a trusted reverse proxy overwrites it, so it is
     * ignored by default. Enable {@code app.rate-limit.trust-forwarded-for} only when the app sits
     * behind a proxy that sets the header.
     */
    private String getClientIP(HttpServletRequest request) {
        if (trustForwardedFor) {
            String xfHeader = request.getHeader("X-Forwarded-For");
            if (xfHeader != null && !xfHeader.isBlank()) {
                return xfHeader.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
