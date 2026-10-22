package com.billpilot.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String TEST_SECRET = "dGhpcy1pcy1hLXZlcnktc2VjdXJlLWFuZC1sb25nLWp3dC1zZWNyZXQta2V5LWZvci1iaWxsLXBpbG90";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(TEST_SECRET, 3600000); // 1 hour
    }

    @Test
    void testGenerateAndValidateToken() {
        String userId = "64f1234567890abcdef12345";
        String token = jwtService.generateToken(userId);

        assertNotNull(token);
        assertTrue(jwtService.validateToken(token));
        assertEquals(userId, jwtService.extractUserId(token));
    }

    @Test
    void testInvalidToken() {
        assertFalse(jwtService.validateToken("invalid.token.here"));
    }

    @Test
    void testMissingSecretFailsStartup() {
        assertThrows(IllegalStateException.class, () -> new JwtService("", 3600000));
        assertThrows(IllegalStateException.class, () -> new JwtService("   ", 3600000));
        assertThrows(IllegalStateException.class, () -> new JwtService(null, 3600000));
    }

    @Test
    void testShortSecretFailsStartup() {
        assertThrows(IllegalStateException.class, () -> new JwtService("short6", 3600000));
        assertThrows(IllegalStateException.class, () -> new JwtService("x".repeat(31), 3600000));
        assertDoesNotThrow(() -> new JwtService("x".repeat(32), 3600000));
    }

    @Test
    void testTokenSignedWithAnotherKeyIsRejected() {
        JwtService other = new JwtService("a-completely-different-secret-of-32+chars!!", 3600000);
        String forged = other.generateToken("64f1234567890abcdef12345");
        assertFalse(jwtService.validateToken(forged));
    }

    @Test
    void testTokenWithoutIssuerIsRejected() {
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String noIssuer = Jwts.builder()
                .subject("64f1234567890abcdef12345")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();
        assertFalse(jwtService.validateToken(noIssuer));
    }

    @Test
    void testExpiredTokenIsRejected() {
        JwtService shortLived = new JwtService(TEST_SECRET, -1000);
        assertFalse(jwtService.validateToken(shortLived.generateToken("64f1234567890abcdef12345")));
    }
}
