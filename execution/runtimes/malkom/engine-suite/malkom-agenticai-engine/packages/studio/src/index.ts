/**
 * @malkom/agenticai-studio — the studio.
 *
 * Building agents, versions, the canvas checks, the sandbox behind the run
 * button. Used by the Command: agents are created, edited, tested and
 * approved there, and nowhere else. Replay, shadow, canary, scorecards and
 * the shop arrive with the testing stage.
 */

export {
  FRAMEWORKS,
  FRAMEWORK_INFO,
  templateManifest,
  templateCode,
  type Framework,
  type TemplateField,
  type QueueType,
  type TemplateRequest,
} from "./template.js";

export {
  compareVersions,
  nextVersion,
  checkPublish,
  type PublishedStatus,
} from "./versions.js";

export {
  checkAgentFit,
  checkConnection,
  assemblePack,
  type QueueFieldSchema,
  type CanvasState,
} from "./canvas.js";

export { runSandbox, type SampleCase, type SandboxOptions, type SandboxReport } from "./sandbox.js";
