package com.tripdesk.api.config;

import java.time.Clock;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SearchProperties.class)
public class ClockConfig {

    @Bean
    public Clock clock(SearchProperties properties) {
        return Clock.system(properties.timeZone());
    }
}
