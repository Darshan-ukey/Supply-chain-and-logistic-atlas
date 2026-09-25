import type {
  MiniEmailError,
  MiniEmailHostConnector,
  MiniEmailProvider
} from './types.js';

/**
 * The contract version this build speaks.
 *
 * Major changes to `MalkomEngineHostConnector` or `MiniEmailHostInput` bump
 * the major. A host on a different major fails loudly on mount rather than
 * behaving strangely at runtime.
 */
export const MINIEMAIL_CONTRACT_VERSION = '1.0.0';

const SUPPORTED_PROVIDERS: readonly MiniEmailProvider[] = ['gmail', 'outlook'];

function fail(
  code: MiniEmailError['code'],
  message: string,
  retryable = false
): MiniEmailError {
  return { code, message, retryable };
}

function majorOf(version: string): string | undefined {
  return version.split('.')[0];
}

/**
 * Validates the host connector before anything else runs.
 *
 * Returns the resolved provider on success, or a precise, actionable error.
 * The engine never guesses its way past a malformed connector.
 */
export function validateHostConnector(
  connector: MiniEmailHostConnector
): { readonly ok: true; readonly provider: MiniEmailProvider } | { readonly ok: false; readonly error: MiniEmailError } {
  if (connector.engine !== 'miniemail') {
    return {
      ok: false,
      error: fail(
        'invalidConnector',
        `Connector targets engine "${connector.engine}", expected "miniemail".`
      )
    };
  }

  const hostMajor = majorOf(connector.contractVersion);
  const engineMajor = majorOf(MINIEMAIL_CONTRACT_VERSION);
  if (!hostMajor || hostMajor !== engineMajor) {
    return {
      ok: false,
      error: fail(
        'contractVersionMismatch',
        `Host contract ${connector.contractVersion} is incompatible with engine contract ${MINIEMAIL_CONTRACT_VERSION}.`
      )
    };
  }

  const { input } = connector;
  if (!input?.connection) {
    return {
      ok: false,
      error: fail('invalidConnector', 'input.connection is required.')
    };
  }

  const { anchor } = input;
  if (!anchor?.conversationId || !anchor.messageId) {
    return {
      ok: false,
      error: fail(
        'invalidConnector',
        'input.anchor requires both conversationId and messageId.'
      )
    };
  }

  const provider = input.provider ?? input.connection.provider;
  if (!provider) {
    return {
      ok: false,
      error: fail(
        'unknownProvider',
        'Provider is neither stated on input nor reported by the connection.'
      )
    };
  }
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return {
      ok: false,
      error: fail(
        'unknownProvider',
        `Provider "${provider}" has no adapter. Supported: ${SUPPORTED_PROVIDERS.join(', ')}.`
      )
    };
  }

  return { ok: true, provider };
}
