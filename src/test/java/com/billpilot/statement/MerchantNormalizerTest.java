package com.billpilot.statement;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MerchantNormalizerTest {

    @Test
    void differentBankFormatsOfOneMerchantShareAKey() {
        assertEquals("netflix", MerchantNormalizer.key("NETFLIX.COM 8007 CA"));
        assertEquals("netflix", MerchantNormalizer.key("UPI-NETFLIX-12345@ybl"));
        assertEquals("netflix", MerchantNormalizer.key("POS DEBIT NETFLIX*MONTHLY"));
    }

    @Test
    void multiWordKnownMerchantsAreResolved() {
        assertEquals("disney+", MerchantNormalizer.key("DISNEY PLUS 0001"));
        assertEquals("disney+", MerchantNormalizer.key("Disney+ subscription"));
        assertEquals("prime video", MerchantNormalizer.key("AMAZON PRIME*MEMBERSHIP"));
        assertEquals("chatgpt plus", MerchantNormalizer.key("OPENAI *CHATGPT SUBSCR"));
    }

    @Test
    void unknownMerchantsUseFirstTwoMeaningfulTokens() {
        assertEquals("gym fit", MerchantNormalizer.key("GYM FIT24 PVT LTD 8812"));
        assertEquals("fitclub", MerchantNormalizer.key("FITCLUB 99812 PVT LTD"));
    }

    @Test
    void numbersAndNoiseAreStripped() {
        assertEquals("", MerchantNormalizer.key("UPI 123456 PAYMENT"));
        assertTrue(MerchantNormalizer.clean("Card 4242 Purchase SWIGGY").equals("swiggy"));
    }

    @Test
    void nullAndBlankAreSafe() {
        assertEquals("", MerchantNormalizer.key(null));
        assertEquals("", MerchantNormalizer.key("   "));
    }
}
