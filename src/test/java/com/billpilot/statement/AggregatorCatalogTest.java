package com.billpilot.statement;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AggregatorCatalogTest {

    @Test
    void appleDescriptorIsAnAggregatorThatGroupsPurchases() {
        var apple = MerchantNormalizer.aggregator("APPLE.COM/BILL 866-712-7753").orElseThrow();
        assertEquals("apple", apple.key());
        assertEquals("Apple", apple.label());
        assertTrue(apple.groupsPurchases());
    }

    @Test
    void marketplaceReferencesShareOneKey() {
        assertEquals("amazon", MerchantNormalizer.key("AMZN MKTP US*2K4"));
        assertEquals("amazon", MerchantNormalizer.key("AMZN MKTP US*7Q1"));
        assertFalse(MerchantNormalizer.aggregator("AMZN MKTP US*2K4").orElseThrow().groupsPurchases());
    }

    @Test
    void knownMerchantsWinOverAggregators() {
        assertEquals("spotify", MerchantNormalizer.key("PAYPAL *SPOTIFY"));
        assertTrue(MerchantNormalizer.aggregator("PAYPAL *SPOTIFY").isEmpty());
        assertEquals("prime video", MerchantNormalizer.key("AMAZON PRIME*MEMBERSHIP"));
        assertTrue(MerchantNormalizer.aggregator("AMAZON PRIME*MEMBERSHIP").isEmpty());
    }

    @Test
    void ordinaryMerchantsAreNotAggregators() {
        assertEquals("netflix", MerchantNormalizer.key("NETFLIX.COM 8007 CA"));
        assertTrue(MerchantNormalizer.aggregator("NETFLIX.COM 8007 CA").isEmpty());
        assertTrue(AggregatorCatalog.find("gym fit").isEmpty());
        assertTrue(AggregatorCatalog.find(null).isEmpty());
    }
}
