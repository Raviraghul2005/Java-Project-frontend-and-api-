package com.billpilot.config;

import com.billpilot.model.Category;
import com.billpilot.model.Frequency;
import com.billpilot.model.SubscriptionStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.lang.NonNull;

import java.util.List;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(
                new FrequencyReadingConverter(),
                new FrequencyWritingConverter(),
                new CategoryReadingConverter(),
                new CategoryWritingConverter(),
                new SubscriptionStatusReadingConverter(),
                new SubscriptionStatusWritingConverter()
        ));
    }

    @ReadingConverter
    public static class FrequencyReadingConverter implements Converter<String, Frequency> {
        @Override
        public Frequency convert(@NonNull String source) {
            return Frequency.fromValue(source);
        }
    }

    @WritingConverter
    public static class FrequencyWritingConverter implements Converter<Frequency, String> {
        @Override
        public String convert(@NonNull Frequency source) {
            return source.getValue();
        }
    }

    @ReadingConverter
    public static class CategoryReadingConverter implements Converter<String, Category> {
        @Override
        public Category convert(@NonNull String source) {
            return Category.fromValue(source);
        }
    }

    @WritingConverter
    public static class CategoryWritingConverter implements Converter<Category, String> {
        @Override
        public String convert(@NonNull Category source) {
            return source.getValue();
        }
    }

    @ReadingConverter
    public static class SubscriptionStatusReadingConverter implements Converter<String, SubscriptionStatus> {
        @Override
        public SubscriptionStatus convert(@NonNull String source) {
            return SubscriptionStatus.fromValue(source);
        }
    }

    @WritingConverter
    public static class SubscriptionStatusWritingConverter implements Converter<SubscriptionStatus, String> {
        @Override
        public String convert(@NonNull SubscriptionStatus source) {
            return source.getValue();
        }
    }
}
