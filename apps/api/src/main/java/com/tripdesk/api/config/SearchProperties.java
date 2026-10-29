package com.tripdesk.api.config;

import java.time.ZoneId;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "tripdesk.search")
public record SearchProperties(
        @DefaultValue("10") int maxGuests,
        @DefaultValue("20") int pageSize,
        @DefaultValue("UTC") ZoneId timeZone) {
}
