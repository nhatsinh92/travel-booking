<!--
Sync Impact Report (temporary; remove before commit)
Version change: 1.0.0 -> 1.1.0 (MINOR: materially expanded guidance in Principle III)
Modified principles: III. Test Every Acceptance Criterion (title unchanged)
Added sections: none
Removed sections: none
Follow-up TODOs: none
-->

# TripDesk Constitution

TripDesk is a learning and portfolio project: a corporate business-travel hotel booking platform,
built by one developer with AI assistance. It is not a production system, and infrastructure
budget is near zero.

## Core Principles

### I. Spec-First
Code MUST NOT be written without a spec under `specs/`. At merge time the spec MUST describe the
implemented behavior.
Rationale: the spec stays the trustworthy description of the system, for the developer and the AI.

### II. Contract-First
The backend OpenAPI document MUST be the single source of truth for the API. The frontend MUST use
a TypeScript client generated from it and MUST NOT hand-write API types.
Rationale: one contract prevents frontend/backend drift.

### III. Test Every Acceptance Criterion
Every acceptance scenario and edge case in a spec MUST have at least one automated test. Task lists
MUST include these test tasks, each naming the spec item it covers.
Logic (the backend, and frontend logic modules) MUST be tested first: its tests are written and
seen failing before the implementation.
Presentational UI components MAY be tested together with or right after the code.
Rationale: criteria that no test checks cannot be trusted as done, and a test never seen failing
has not been shown to check anything.

### IV. Simplicity
The backend MUST stay basic: a single Spring Boot application, with no message brokers or
microservices.
Rationale: one developer and a near-zero budget cannot carry distributed-system overhead.

### V. AI Code Contract
A new dependency MUST NOT be added without approval in the plan. AI MUST state its assumptions
instead of guessing.
Rationale: AI-generated changes stay reviewable, and hidden guesses become visible decisions.

## Stack & Scope

- Stack: monorepo; Next.js + TypeScript; Java 21 + Spring Boot; PostgreSQL; Redis; Docker Compose.
- Non-goals: production-grade operations, high availability, real payments.

## Governance

- This constitution supersedes other practices; plans and reviews SHOULD check compliance with it.
- Amendments MUST bump the version semantically: MAJOR for removing or redefining a principle,
  MINOR for adding a principle or materially expanding guidance, PATCH for clarifications.
- A justified deviation from a principle MAY be recorded in the plan's Complexity Tracking table.

**Version**: 1.1.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
