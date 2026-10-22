package com.billpilot.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RateLimitFilterHardeningTest {

    private HttpServletRequest request(String uri, String remoteAddr, String forwardedFor) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        when(request.getHeader("X-Forwarded-For")).thenReturn(forwardedFor);
        return request;
    }

    private HttpServletResponse response() throws Exception {
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        return response;
    }

    @Test
    void spoofedForwardedForHeaderDoesNotGrantFreshBuckets() throws Exception {
        // capacity 3, no refill worth mentioning, X-Forwarded-For NOT trusted (default)
        RateLimitFilter filter = new RateLimitFilter(3, 1, 3600);
        FilterChain chain = mock(FilterChain.class);

        for (int i = 0; i < 10; i++) {
            filter.doFilterInternal(request("/api/v1/subscriptions", "203.0.113.9", "10.0.0." + i), response(), chain);
        }

        verify(chain, times(3)).doFilter(any(), any());
    }

    @Test
    void forwardedForIsHonouredOnlyWhenExplicitlyTrusted() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(1, 1, 3600, 10, 5, 60, true);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request("/api/v1/subscriptions", "127.0.0.1", "198.51.100.1"), response(), chain);
        filter.doFilterInternal(request("/api/v1/subscriptions", "127.0.0.1", "198.51.100.2"), response(), chain);
        filter.doFilterInternal(request("/api/v1/subscriptions", "127.0.0.1", "198.51.100.1"), response(), chain);

        // two distinct client IPs get one request each; the repeat from the first IP is throttled
        verify(chain, times(2)).doFilter(any(), any());
    }

    @Test
    void authRoutesHaveTheirOwnStricterBucket() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(100, 100, 60, 2, 1, 3600, false);
        FilterChain chain = mock(FilterChain.class);

        for (int i = 0; i < 5; i++) {
            filter.doFilterInternal(request("/api/v1/auth/sign-in", "203.0.113.9", null), response(), chain);
        }
        verify(chain, times(2)).doFilter(any(), any());

        // the general bucket for the same client is unaffected
        filter.doFilterInternal(request("/api/v1/subscriptions", "203.0.113.9", null), response(), chain);
        verify(chain, times(3)).doFilter(any(), any());
    }

    @Test
    void throttledResponseCarriesRetryAfter() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(1, 1, 120);
        FilterChain chain = mock(FilterChain.class);
        filter.doFilterInternal(request("/api/v1/subscriptions", "203.0.113.9", null), response(), chain);

        HttpServletResponse denied = response();
        filter.doFilterInternal(request("/api/v1/subscriptions", "203.0.113.9", null), denied, chain);

        verify(denied).setStatus(429);
        verify(denied).setHeader(eq("Retry-After"), argThat(v -> Long.parseLong(v) >= 1));
    }

    @Test
    void workflowsAreNoLongerExemptFromRateLimiting() {
        RateLimitFilter filter = new RateLimitFilter(5, 1, 60);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/workflows/subscription/reminder");

        assertFalse(filter.shouldNotFilter(request));
    }
}
