# MISSION: Build the "RPG Quest Orchestrator" MCP Core

## CONTEXT & ROLE

You are an Elite Technical Architect. Your task is to build the Core Domain of an MCP (Model Context Protocol) server. This server acts as an automated "Dungeon Master" (Orchestrator) for multi-agent workflows. The core philosophy is "Simple vs. Easy". Do not leak infrastructure details into the domain. Use strict Domain-Driven Design (DDD) and Hexagonal Architecture principles (Ports & Adapters).

---

## CORE CONCEPT: The World Event Loop

Unlike standard chat servers, this MCP executes a chaotic feedback loop. The user assigns a **Quest** (a bug, a feature, a refactor). The AI Agents propose code/architectural solutions. The MCP takes that proposal, executes a **WorldEvent** (compiles, runs tests, triggers load tests), and returns the raw logs/traces to the Agents. The Agents iterate until the **WorldEvent** passes perfectly.

---

## DOMAIN ENTITIES (Ubiquitous Language)

1. **`Campaign` (Aggregate Root):** Manages the state machine of the current quest.
2. **`Adventurer` (Value Object):** The AI Agent interacting with the system (e.g., "Paladin_Backend", "Rogue_QA").
3. **`Quest` (Entity):** The mission objective (e.g., "Fix memory leak in Rust event bridge", "Refactor Auth module"). Contains the `AcceptanceCriteria`.
4. **`WorldEvent` (Value Object):** An action executed against the real environment (e.g., `TestExecution`, `BuildProcess`, `LoadTest`). Returns a `WorldState` (Success/Failure + Logs).

---

## STATE MACHINE (Strict Enforcement)

The `Campaign` MUST transition through these exact states:

| State | Meaning |
|-------|--------|
| `BRIEFING` | The DM (Human) sets the `Quest`. Agents read the context. No actions allowed yet. |
| `ADVENTURING` | Agents can propose solutions. |
| `EVALUATING` | The system is locked. A `WorldEvent` is running in the background. Agents must WAIT. |
| `RECALCULATING` | The `WorldEvent` failed. Agents read the raw logs (the "damage taken") and iterate. Returns to `ADVENTURING`. |
| `VICTORY` | The `WorldEvent` passed the `AcceptanceCriteria`. The quest is sealed. Code is ready for commit. |

---

## REQUIRED PORTS (MCP Tools & Resources)

### Resources (Passive State)

- **`quest://campaign/current_objective`:** Returns the `Quest` details and `AcceptanceCriteria`.
- **`quest://campaign/world_state`:** Returns the output logs of the last executed `WorldEvent`.

### Tools (Active Mutations)

- **`accept_quest(adventurer_name: string)`:** Registers the agent in the campaign.

- **`propose_action(adventurer_name: string, hypothesis_description: string, command_to_run: string)`**
  - **Rule:** Triggers a `WorldEvent`.
  - **Behavior:** The domain transitions to `EVALUATING`, dispatches the `command_to_run` to the infrastructure adapter (e.g., a shell runner or Docker executor), and waits.

- **`observe_world(adventurer_name: string)`**
  - **Behavior:** Uses long-polling. If state is `EVALUATING`, it blocks. Once the `WorldEvent` finishes, it returns the raw standard output/error logs to the model.

---

## ARCHITECTURAL CONSTRAINTS (Crucial)

1. **No Infrastructure in the Core:** The core domain MUST NOT know how to run a shell command, how to use `k6`, or how to spin up Docker. It must expose an interface (e.g., `IWorldEventRunner`) that the infrastructure layer will implement.

2. **Fail-Fast Loop:** If an Agent submits a `propose_action` that results in a compilation error, the domain instantly updates the `world_state` with the stack trace and shifts to `RECALCULATING`.

3. **No Hallucinated Success:** The Agents CANNOT vote to end the quest. Only a successful `WorldEvent` (exit code 0 from the test/runner) can transition the state to `VICTORY`.

---

## OUTPUT INSTRUCTIONS

1. Define the TypeScript/Go interfaces for the Entities and the State Machine.
2. Define the Input/Output DTOs for the MCP Tools.
3. Implement the Use Case (Application Service) for `propose_action` handling the state transitions.

Do not write the infrastructure adapters yet. Focus 100% on the core domain logic.
