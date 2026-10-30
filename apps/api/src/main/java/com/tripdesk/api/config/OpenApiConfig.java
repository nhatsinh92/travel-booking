package com.tripdesk.api.config;

import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;

@Configuration(proxyBeanMethods = false)
@OpenAPIDefinition(info = @Info(title = "TripDesk API", version = "0.1.0"))
public class OpenApiConfig {
}
