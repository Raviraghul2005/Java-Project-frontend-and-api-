package com.billpilot.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EnumsSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void testFrequencyCaseInsensitiveDeserialization() throws Exception {
        assertEquals(Frequency.MONTHLY, objectMapper.readValue("\"monthly\"", Frequency.class));
        assertEquals(Frequency.MONTHLY, objectMapper.readValue("\"MONTHLY\"", Frequency.class));
        assertEquals(Frequency.MONTHLY, objectMapper.readValue("\"Monthly\"", Frequency.class));
        assertEquals(Frequency.YEARLY, objectMapper.readValue("\"yearly\"", Frequency.class));
        assertEquals(Frequency.WEEKLY, objectMapper.readValue("\"weekly\"", Frequency.class));
        assertEquals(Frequency.DAILY, objectMapper.readValue("\"daily\"", Frequency.class));
    }

    @Test
    void testCategoryCaseInsensitiveDeserialization() throws Exception {
        assertEquals(Category.ENTERTAINMENT, objectMapper.readValue("\"entertainment\"", Category.class));
        assertEquals(Category.ENTERTAINMENT, objectMapper.readValue("\"ENTERTAINMENT\"", Category.class));
        assertEquals(Category.TECHNOLOGY, objectMapper.readValue("\"technology\"", Category.class));
        assertEquals(Category.FINANCE, objectMapper.readValue("\"finance\"", Category.class));
        assertEquals(Category.LIFESTYLE, objectMapper.readValue("\"lifestyle\"", Category.class));
    }

    @Test
    void testSubscriptionStatusCaseInsensitiveDeserialization() throws Exception {
        assertEquals(SubscriptionStatus.ACTIVE, objectMapper.readValue("\"active\"", SubscriptionStatus.class));
        assertEquals(SubscriptionStatus.ACTIVE, objectMapper.readValue("\"ACTIVE\"", SubscriptionStatus.class));
        assertEquals(SubscriptionStatus.CANCELLED, objectMapper.readValue("\"cancelled\"", SubscriptionStatus.class));
        assertEquals(SubscriptionStatus.EXPIRED, objectMapper.readValue("\"expired\"", SubscriptionStatus.class));
    }

    @Test
    void testInvalidEnumValueThrowsIllegalArgument() {
        assertThrows(Exception.class, () -> objectMapper.readValue("\"unknown_val\"", Frequency.class));
        assertThrows(Exception.class, () -> objectMapper.readValue("\"non_category\"", Category.class));
    }
}
