package com.tripdesk.api.support;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import com.tripdesk.api.config.SearchProperties;

@TestConfiguration(proxyBeanMethods = false)
public class FixedClockConfig {

    public static final LocalDate TODAY = LocalDate.of(2026, 10, 29);

    @Bean
    @Primary
    public Clock fixedClock(SearchProperties properties) {
        var noon = TODAY.atTime(12, 0).atZone(properties.timeZone()).toInstant();
        return Clock.fixed(noon, properties.timeZone());
    }
}
