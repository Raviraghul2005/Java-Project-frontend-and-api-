package com.billpilot.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class RateLimitFilterTest {

    private RateLimitFilter rateLimitFilter;

    @BeforeEach
    void setUp() {
        // Capacity: 5, Refill: 1 token per 60 seconds for deterministic testing
        rateLimitFilter = new RateLimitFilter(5, 1, 60);
    }

    @Test
    void testRateLimiterPermitsWithinCapacityAndBlocksWhenExceeded() throws ServletException, IOException {
        String testIp = "192.168.1.100";
        FilterChain filterChain = mock(FilterChain.class);

        // First 5 requests should pass
        for (int i = 0; i < 5; i++) {
            HttpServletRequest request = mock(HttpServletRequest.class);
            HttpServletResponse response = mock(HttpServletResponse.class);
            when(request.getRequestURI()).thenReturn("/api/v1/subscriptions");
            when(request.getRemoteAddr()).thenReturn(testIp);

            rateLimitFilter.doFilterInternal(request, response, filterChain);
        }

        verify(filterChain, times(5)).doFilter(any(), any());

        // 6th request should be blocked with 429
        HttpServletRequest deniedRequest = mock(HttpServletRequest.class);
        HttpServletResponse deniedResponse = mock(HttpServletResponse.class);
        StringWriter stringWriter = new StringWriter();
        PrintWriter writer = new PrintWriter(stringWriter);

        when(deniedRequest.getRequestURI()).thenReturn("/api/v1/subscriptions");
        when(deniedRequest.getRemoteAddr()).thenReturn(testIp);
        when(deniedResponse.getWriter()).thenReturn(writer);

        rateLimitFilter.doFilterInternal(deniedRequest, deniedResponse, filterChain);

        verify(deniedResponse).setStatus(429);
        verify(filterChain, times(5)).doFilter(any(), any()); // should NOT have increased to 6
    }

    @Test
    void testOptionsRequestBypassesRateLimiter() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("OPTIONS");
        when(request.getRequestURI()).thenReturn("/api/v1/subscriptions");

        boolean shouldNotFilter = rateLimitFilter.shouldNotFilter(request);
        org.junit.jupiter.api.Assertions.assertTrue(shouldNotFilter);
    }

    @Test
    void testStaticFileBypassesRateLimiter() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/styles/broadside.css");

        boolean shouldNotFilter = rateLimitFilter.shouldNotFilter(request);
        org.junit.jupiter.api.Assertions.assertTrue(shouldNotFilter);
    }
}
