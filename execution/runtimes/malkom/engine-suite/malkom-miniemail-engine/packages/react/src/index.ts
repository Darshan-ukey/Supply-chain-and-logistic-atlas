/**
 * @malkom/miniemail-react — React bindings.
 *
 * This package owns no behaviour. It mounts the core engine into React's
 * lifecycle and re-exports the contract, so a host imports from one place.
 */

export {
  useMiniEmail,
  type UseMiniEmailOptions,
  type UseMiniEmailResult
} from './useMiniEmail.js';

export { MiniEmailFrame, type MiniEmailFrameProps } from './MiniEmailFrame.js';

export type {
  MalkomEngineHostConnector,
  MiniEmailHostConnector,
  MiniEmailHostInput,
  MiniEmailOptions,
  MiniEmailEvent,
  MiniEmailState,
  MiniEmailEngine,
  MiniEmailAvailability,
  MiniEmailMessage,
  MiniEmailThread,
  MiniEmailAddress,
  MiniEmailAttachment,
  MiniEmailComposeDraft,
  MiniEmailComposeMode,
  MiniEmailSearchQuery,
  MiniEmailSearchResult,
  MiniEmailCapabilities,
  MiniEmailError
} from '@malkom/miniemail-core';
