import type { FailureType } from "./manifest.js";

/**
 * A failure an adapter can raise, carrying its type — so the runner can apply
 * the manifest's retries by type of failure. A network error or a dead AI
 * endpoint is worth retrying; a wrong answer is not. Anything an adapter
 * throws that is not one of these is not retried at all: the run ends as a
 * handover, and the case goes to a person.
 */
export class AgentFailure extends Error {
  constructor(
    readonly failure: FailureType,
    message: string,
  ) {
    super(message);
    this.name = "AgentFailure";
  }
}

export const isAgentFailure = (error: unknown): error is AgentFailure =>
  error instanceof AgentFailure;
