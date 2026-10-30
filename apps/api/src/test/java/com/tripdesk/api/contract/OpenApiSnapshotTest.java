package com.tripdesk.api.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripdesk.api.support.AbstractIntegrationTest;

/**
 * Contract drift guard (constitution Principle II): the OpenAPI document served by the running
 * application must equal the committed snapshot. The snapshot is refreshed only on purpose, with
 * {@code ./gradlew refreshOpenApiSnapshot}, which sets {@value #REFRESH_PROPERTY}.
 */
class OpenApiSnapshotTest extends AbstractIntegrationTest {

    static final String REFRESH_PROPERTY = "openapi.snapshot.refresh";
    private static final Path SNAPSHOT = Path.of("openapi", "openapi.json");

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void theGeneratedDocumentMatchesTheCommittedSnapshot() throws Exception {
        String body = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode generated = objectMapper.readTree(body);

        if (Boolean.getBoolean(REFRESH_PROPERTY)) {
            DefaultPrettyPrinter printer = new DefaultPrettyPrinter()
                    .withObjectIndenter(new DefaultIndenter("  ", "\n"))
                    .withArrayIndenter(new DefaultIndenter("  ", "\n"));
            Files.createDirectories(SNAPSHOT.getParent());
            Files.writeString(SNAPSHOT,
                    objectMapper.writer(printer).writeValueAsString(generated) + "\n",
                    StandardCharsets.UTF_8);
            return;
        }

        assertThat(SNAPSHOT)
                .as("committed snapshot; create it with ./gradlew refreshOpenApiSnapshot")
                .exists();
        JsonNode committed = objectMapper.readTree(Files.readString(SNAPSHOT, StandardCharsets.UTF_8));
        assertThat(generated)
                .as("generated OpenAPI document differs from %s; if the change is intended run "
                        + "./gradlew refreshOpenApiSnapshot and commit the result", SNAPSHOT)
                .isEqualTo(committed);
    }
}
