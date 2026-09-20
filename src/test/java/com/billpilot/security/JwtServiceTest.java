package com.billpilot.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        String testSecret = "dGhpcy1pcy1hLXZlcnktc2VjdXJlLWFuZC1sb25nLWp3dC1zZWNyZXQta2V5LWZvci1iaWxsLXBpbG90";
        jwtService = new JwtService(testSecret, 3600000); // 1 hour
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
}
