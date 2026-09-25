/**
 * Connector registry — every connector the platform offers, as typed
 * descriptors. Config is declared as typed field metadata (the same
 * pattern the control plane's service catalogue uses, so the UI renders
 * it without bespoke forms) and validated by `validateConfig`.
 *
 * `execution` decides how the engine runs a connector:
 *   http    — engine executes natively over fetch (no extra deps)
 *   staged  — engine renders + stores the payload PREPARED; the host's
 *             transport collects it (credentials stay with the host)
 *   custom  — declarative HTTP definition (CustomConnectorDef) interpreted
 *             by the engine
 *   adapter — a host-registered adapter executes (cloud SDKs live with
 *             the host, never inside the engine)
 *   none    — configuration-only (inbound endpoints the host serves,
 *             infra targets the provisioner consumes)
 */

export type Plane = 'data' | 'infra';
export type ConnectorCategory =
  | 'transport'
  | 'storage'
  | 'queue'
  | 'database'
  | 'docai'
  | 'saas'
  | 'ai'
  | 'identity'
  | 'vault'
  | 'logistics'
  | 'infra';
export type Direction = 'input' | 'output' | 'both' | 'none';
export type Capability = 'poll' | 'webhook' | 'read' | 'write' | 'list' | 'test' | 'notify' | 'tool' | 'provision';
export type AuthScheme =
  | 'none'
  | 'apiKey'
  | 'basic'
  | 'bearer'
  | 'oauth2-cc'
  | 'oauth2-code'
  | 'hmac'
  | 'mtls'
  | 'iam-keys'
  | 'iam-role'
  | 'sas'
  | 'service-principal'
  | 'service-account'
  | 'ssh-key'
  | 'connection-string';
export type ExecutionMode = 'http' | 'staged' | 'custom' | 'adapter' | 'none';
export type TestStrategy = 'http-ping' | 'custom-op' | 'adapter' | 'config-only';

/** Provider family a connector belongs to — drives catalog grouping and
 *  the fully-qualified id (`aws.store.s3`). `other` covers protocol-level
 *  and SaaS-vendor connectors that belong to no cloud family. */
export type Provider = 'aws' | 'gcp' | 'microsoft' | 'byos' | 'other';

const PROVIDER_OF: Record<string, Provider> = {
  /* AWS */
  'store.s3': 'aws', 'queue.sqs': 'aws', 'queue.eventbridge': 'aws', 'db.dynamo': 'aws',
  'docai.textract': 'aws', 'ai.bedrock': 'aws', 'vault.aws': 'aws', 'infra.aws': 'aws',
  /* Microsoft / Azure */
  'store.azblob': 'microsoft', 'queue.servicebus': 'microsoft', 'queue.eventgrid': 'microsoft',
  'db.cosmos': 'microsoft', 'docai.azdi': 'microsoft', 'store.sharepoint': 'microsoft',
  'saas.teams': 'microsoft', 'vault.azkv': 'microsoft', 'infra.azure': 'microsoft',
  /* Google / GCP */
  'store.gcs': 'gcp', 'queue.pubsub': 'gcp', 'db.bigquery': 'gcp', 'docai.gdocai': 'gcp',
  'ai.vertex': 'gcp', 'saas.gsheets': 'gcp', 'store.gdrive': 'gcp', 'infra.gcp': 'gcp',
  /* Bring-your-own-stack (self-hosted / client-owned) */
  'queue.kafka': 'byos', 'queue.rabbit': 'byos', 'file.watch': 'byos', 'db.read': 'byos',
  'db.write': 'byos', 'ai.ollama': 'byos', 'docai.self': 'byos', 'id.ldap': 'byos',
  'infra.byos': 'byos',
};

export const providerOf = (id: string): Provider => PROVIDER_OF[id] ?? 'other';

/** Fully-qualified id: family-prefixed for cloud/BYOS connectors
 *  (`aws.store.s3`), plain for provider-neutral ones. */
export const fqidOf = (id: string): string => {
  const provider = providerOf(id);
  return provider === 'other' ? id : `${provider}.${id}`;
};

export type FieldType = 'text' | 'num' | 'select' | 'tog' | 'chips' | 'area';

export interface ConnectorField {
  readonly k: string;
  readonly l: string;
  readonly t: FieldType;
  readonly o?: readonly string[];
  readonly d: unknown;
  readonly h?: string;
  readonly req?: boolean;
}

export interface ConnectorDescriptor {
  readonly id: string;
  /** family-prefixed id, e.g. `aws.store.s3` */
  readonly fqid: string;
  readonly provider: Provider;
  readonly name: string;
  readonly plane: Plane;
  readonly category: ConnectorCategory;
  readonly direction: Direction;
  readonly capabilities: readonly Capability[];
  readonly auth: readonly AuthScheme[];
  /** named secret slots a connection fills with vault/env references */
  readonly secretSlots: readonly string[];
  readonly execution: ExecutionMode;
  readonly test: TestStrategy;
  readonly blurb: string;
  readonly cfg: readonly ConnectorField[];
}

const conn = (
  id: string,
  name: string,
  plane: Plane,
  category: ConnectorCategory,
  direction: Direction,
  capabilities: readonly Capability[],
  auth: readonly AuthScheme[],
  secretSlots: readonly string[],
  execution: ExecutionMode,
  test: TestStrategy,
  blurb: string,
  cfg: readonly ConnectorField[] = [],
): ConnectorDescriptor => ({
  id, fqid: fqidOf(id), provider: providerOf(id),
  name, plane, category, direction, capabilities, auth, secretSlots, execution, test, blurb, cfg,
});

const url = (k: string, l: string, d = ''): ConnectorField => ({ k, l, t: 'text', d, req: true });
const txt = (k: string, l: string, d = '', req = false): ConnectorField => ({ k, l, t: 'text', d, req });
const num = (k: string, l: string, d: number): ConnectorField => ({ k, l, t: 'num', d });
const tog = (k: string, l: string, d: boolean): ConnectorField => ({ k, l, t: 'tog', d });
const sel = (k: string, l: string, o: readonly string[], d: string): ConnectorField => ({ k, l, t: 'select', o, d });

export const CONNECTORS: readonly ConnectorDescriptor[] = [
  /* ================= Tier 0 — generic transports ================= */
  conn('src.api', 'Inbound API', 'data', 'transport', 'input', ['webhook', 'test'], ['apiKey', 'oauth2-cc', 'hmac', 'mtls'], ['apiKey'], 'none', 'config-only',
    'Client systems push submissions over an authenticated API the host serves.', [
      sel('auth', 'Authentication', ['API key', 'OAuth2 client credentials', 'HMAC signature', 'mTLS'], 'API key'),
      num('rate', 'Rate limit (req/min)', 600),
    ]),
  conn('src.webhook', 'Inbound webhook', 'data', 'transport', 'input', ['webhook', 'test'], ['hmac', 'none'], ['signingSecret'], 'none', 'config-only',
    'Push events from any SaaS or carrier; per-connection signed URL, verified and staged.', [
      sel('verify', 'Signature verification', ['HMAC-SHA256', 'None (allow-list only)'], 'HMAC-SHA256'),
      txt('allow', 'Source IP allow-list (comma separated)'),
    ]),
  conn('out.rest', 'REST write-back', 'data', 'transport', 'output', ['write', 'test'], ['apiKey', 'bearer', 'basic', 'none'], ['authToken'], 'http', 'http-ping',
    'Deliver results to an API endpoint over HTTP POST.', [
      url('endpoint', 'Endpoint URL'),
      num('timeoutMs', 'Timeout (ms)', 15_000),
      tog('verify', 'Verify by read-back', false),
    ]),
  conn('src.sftp', 'SFTP drop', 'data', 'transport', 'input', ['poll', 'read', 'test'], ['basic', 'ssh-key'], ['password', 'privateKey'], 'adapter', 'adapter',
    'Watch a directory for files dropped on a schedule.', [
      url('host', 'Host'), num('port', 'Port', 22), txt('path', 'Watch path', '/in/docs', true), txt('pattern', 'Filename pattern', '*.pdf'),
      tog('dedupe', 'Dedupe by content hash', true),
    ]),
  conn('out.sftp', 'SFTP delivery', 'data', 'transport', 'output', ['write', 'test'], ['basic', 'ssh-key'], ['password', 'privateKey'], 'staged', 'config-only',
    'File delivery to a partner SFTP; payloads staged for the host transport.', [
      url('host', 'Host'), num('port', 'Port', 22), txt('path', 'Destination path', '/out/processed', true), tog('checksum', 'Write checksum file', true),
    ]),
  conn('src.mailbox', 'Email in', 'data', 'transport', 'input', ['poll', 'read', 'test'], ['oauth2-code', 'basic'], ['clientSecret', 'password'], 'adapter', 'adapter',
    'Fetch, thread, dedupe and split attachments before a task exists.', [
      sel('provider', 'Mail provider', ['Microsoft Graph', 'IMAP', 'Gmail API'], 'Microsoft Graph'),
      txt('folders', 'Folders watched', 'Docs Inbox'),
      sel('grain', 'Task granularity', ['One task per email', 'One task per attachment', 'One task per thread'], 'One task per attachment'),
    ]),
  conn('out.mail', 'Email out', 'data', 'transport', 'output', ['write', 'notify', 'test'], ['oauth2-code', 'basic'], ['clientSecret', 'password'], 'staged', 'config-only',
    'Replies, confirmations and document delivery; staged for the host mailer.', [
      sel('provider', 'Mail provider', ['Microsoft Graph', 'SMTP', 'Gmail API', 'SES'], 'SMTP'),
      sel('to', 'Recipients', ['Reply to sender', 'Fixed distribution'], 'Reply to sender'),
      txt('distribution', 'Fixed distribution list'),
    ]),
  conn('src.edi', 'EDI receiver', 'data', 'transport', 'input', ['poll', 'read', 'test'], ['basic', 'mtls'], ['password'], 'adapter', 'adapter',
    'Structured carrier and partner messaging (X12 / EDIFACT).', [
      { k: 'sets', l: 'Transaction sets', t: 'chips', o: ['300', '301', '315', '214', '204', '990', 'IFTMIN', 'IFTSTA', 'COPARN'], d: ['315', '214'] },
      tog('ack', 'Send 997 / CONTRL acknowledgement', true),
    ]),
  conn('out.edi', 'EDI send', 'data', 'transport', 'output', ['write', 'test'], ['basic', 'mtls'], ['password'], 'staged', 'config-only',
    'Structured messaging back to carrier or partner; staged for the host transport.', [
      sel('set', 'Transaction set', ['310', '315', '214', '990', 'IFTMIN', 'IFTSTA'], '315'), url('endpoint', 'Partner endpoint'),
    ]),
  conn('db.read', 'Database source', 'data', 'database', 'input', ['poll', 'read', 'test'], ['basic', 'connection-string'], ['password', 'connectionString'], 'adapter', 'adapter',
    'Scheduled query against a client database; rows become tasks.', [
      sel('flavor', 'Database', ['PostgreSQL', 'MySQL', 'SQL Server', 'MongoDB'], 'PostgreSQL'),
      url('host', 'Host'), num('port', 'Port', 5432), txt('database', 'Database', '', true), { k: 'query', l: 'Query', t: 'area', d: '', req: true },
      txt('cursorField', 'Incremental cursor field', 'updated_at'),
    ]),
  conn('db.write', 'Database sink', 'data', 'database', 'output', ['write', 'test'], ['basic', 'connection-string'], ['password', 'connectionString'], 'adapter', 'adapter',
    'Write results into client database tables; upsert by declared key.', [
      sel('flavor', 'Database', ['PostgreSQL', 'MySQL', 'SQL Server', 'MongoDB'], 'PostgreSQL'),
      url('host', 'Host'), num('port', 'Port', 5432), txt('database', 'Database', '', true), txt('table', 'Table', '', true), txt('key', 'Upsert key', 'id'),
    ]),
  conn('file.watch', 'Shared-folder watch', 'data', 'transport', 'input', ['poll', 'read', 'test'], ['none'], [], 'adapter', 'adapter',
    'Mounted volume / NFS / SMB drop directories on the client host.', [
      txt('path', 'Watch path', '', true), txt('pattern', 'Filename pattern', '*'),
    ]),
  conn('mail.client', 'Mailbox client', 'data', 'transport', 'both',
    ['read', 'write', 'list', 'test', 'tool'], ['oauth2-code', 'oauth2-cc'], ['accessToken', 'refreshToken', 'clientSecret'], 'adapter', 'adapter',
    'An interactive mailbox for the runtime’s email package: read a thread, search the real mailbox, reply, forward and send. The connector holds the credentials and makes the authenticated call; the email engine never sees them.', [
    sel('provider', 'Provider', ['gmail', 'outlook'], 'outlook'),
    txt('mailboxAddress', 'Mailbox address', '', true),
    txt('clientId', 'OAuth client id', '', true),
    txt('tenantId', 'Directory (tenant) id', '', false),
    // Capability, not preference: an organisation can be given a mailbox it
    // may read but not send from, and the email package must obey that
    // rather than offer a button that will be refused.
    tog('canRead', 'Read messages and threads', true),
    tog('canSearch', 'Search the mailbox', true),
    tog('canSend', 'Send and reply', true),
    tog('canDraft', 'Save drafts', true),
    tog('canFetchAttachments', 'Download attachments', true),
    tog('canModifyParticipants', 'Add and remove participants', true),
  ]),
  conn('custom.http', 'Custom HTTP connector', 'data', 'transport', 'both', ['read', 'write', 'test', 'tool'], ['none', 'apiKey', 'bearer', 'basic'], ['secret'], 'custom', 'custom-op',
    'Org-defined declarative connector: base URL, auth, operations — no code.', [
      txt('customDefId', 'Custom definition id', '', true),
    ]),

  /* ================= Tier 1 — cloud storage ================= */
  conn('store.s3', 'S3 / S3-compatible', 'data', 'storage', 'both', ['poll', 'read', 'write', 'list', 'test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'adapter', 'adapter',
    'AWS S3 and any S3-compatible store (MinIO, Wasabi, R2) — endpoint is config.', [
      txt('endpoint', 'Endpoint (blank = AWS)'), txt('region', 'Region', 'us-east-1'), txt('bucket', 'Bucket', '', true), txt('prefix', 'Prefix', 'in/'),
    ]),
  conn('store.azblob', 'Azure Blob Storage', 'data', 'storage', 'both', ['poll', 'read', 'write', 'list', 'test'], ['sas', 'service-principal', 'connection-string'], ['connectionString', 'clientSecret'], 'adapter', 'adapter',
    'Azure Blob containers as source or sink.', [
      txt('account', 'Storage account', '', true), txt('container', 'Container', '', true), txt('prefix', 'Prefix'),
    ]),
  conn('store.gcs', 'Google Cloud Storage', 'data', 'storage', 'both', ['poll', 'read', 'write', 'list', 'test'], ['service-account'], ['serviceAccountJson'], 'adapter', 'adapter',
    'GCS buckets as source or sink.', [
      txt('endpoint', 'Endpoint (blank = Google)'), txt('bucket', 'Bucket', '', true), txt('prefix', 'Prefix'),
    ]),
  conn('store.sharepoint', 'SharePoint', 'data', 'storage', 'both', ['poll', 'read', 'write', 'test'], ['oauth2-cc'], ['clientSecret'], 'adapter', 'adapter',
    'Client document libraries over Microsoft Graph.', [
      txt('site', 'Site', '', true), txt('library', 'Library', 'Documents'),
    ]),
  conn('store.gdrive', 'Google Drive', 'data', 'storage', 'both', ['poll', 'read', 'write', 'test'], ['service-account', 'oauth2-code'], ['serviceAccountJson'], 'adapter', 'adapter',
    'Shared drives and folders as source or sink.', [
      txt('folderId', 'Folder id', '', true),
    ]),

  /* ================= Tier 1 — queues & events ================= */
  conn('queue.sqs', 'AWS SQS / SNS', 'data', 'queue', 'both', ['poll', 'read', 'write', 'test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'adapter', 'adapter',
    'Consume SQS queues; publish completion events to SQS or SNS.', [
      txt('region', 'Region', 'us-east-1'), url('queueUrl', 'Queue URL'),
    ]),
  conn('queue.servicebus', 'Azure Service Bus', 'data', 'queue', 'both', ['poll', 'read', 'write', 'test'], ['connection-string', 'service-principal'], ['connectionString'], 'adapter', 'adapter',
    'Queues and topics; sessions for ordered processing.', [
      txt('namespace', 'Namespace', '', true), txt('queue', 'Queue / topic', '', true),
    ]),
  conn('queue.pubsub', 'GCP Pub/Sub', 'data', 'queue', 'both', ['poll', 'read', 'write', 'test'], ['service-account'], ['serviceAccountJson'], 'adapter', 'adapter',
    'Pull subscriptions in; topic publish out.', [
      txt('project', 'Project', '', true), txt('topic', 'Topic', '', true), txt('subscription', 'Subscription'),
    ]),
  conn('queue.kafka', 'Kafka / Redpanda', 'data', 'queue', 'both', ['poll', 'read', 'write', 'test'], ['basic', 'none'], ['saslPassword'], 'adapter', 'adapter',
    'Consumer group in; producer out. BYOS clusters welcome.', [
      txt('brokers', 'Brokers (comma separated)', '', true), txt('topic', 'Topic', '', true), txt('groupId', 'Consumer group', 'malkom'),
    ]),
  conn('queue.rabbit', 'RabbitMQ', 'data', 'queue', 'both', ['poll', 'read', 'write', 'test'], ['basic'], ['password'], 'adapter', 'adapter',
    'AMQP queues in and out; quorum queues recommended.', [
      url('host', 'Host'), num('port', 'Port', 5672), txt('queue', 'Queue', '', true), txt('vhost', 'VHost', '/'),
    ]),

  /* ================= Tier 1 — warehouses / NoSQL ================= */
  conn('db.bigquery', 'BigQuery', 'data', 'database', 'output', ['write', 'test'], ['service-account'], ['serviceAccountJson'], 'adapter', 'adapter',
    'Analytics sink: read models and metrics exports.', [
      txt('project', 'Project', '', true), txt('dataset', 'Dataset', '', true),
    ]),
  conn('db.dynamo', 'DynamoDB', 'data', 'database', 'both', ['read', 'write', 'test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'adapter', 'adapter',
    'NoSQL client stores, read/write.', [
      txt('region', 'Region', 'us-east-1'), txt('table', 'Table', '', true),
    ]),
  conn('db.cosmos', 'Cosmos DB', 'data', 'database', 'both', ['read', 'write', 'test'], ['connection-string'], ['connectionString'], 'adapter', 'adapter',
    'Azure NoSQL client stores, read/write.', [
      txt('database', 'Database', '', true), txt('container', 'Container', '', true),
    ]),

  /* ================= Doc-AI providers ================= */
  conn('docai.textract', 'AWS Textract', 'data', 'docai', 'none', ['tool', 'test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'adapter', 'adapter',
    'OCR + form/table extraction backing classify/extract steps.', [txt('region', 'Region', 'us-east-1')]),
  conn('docai.azdi', 'Azure Document Intelligence', 'data', 'docai', 'none', ['tool', 'test'], ['apiKey'], ['apiKey'], 'adapter', 'adapter',
    'Prebuilt and custom extraction models.', [url('endpoint', 'Endpoint')]),
  conn('docai.gdocai', 'Google Document AI', 'data', 'docai', 'none', ['tool', 'test'], ['service-account'], ['serviceAccountJson'], 'adapter', 'adapter',
    'Processor-based extraction.', [txt('project', 'Project', '', true), txt('processor', 'Processor id', '', true)]),
  conn('docai.self', 'Self-hosted Doc-AI', 'data', 'docai', 'none', ['tool', 'test'], ['apiKey', 'none'], ['apiKey'], 'http', 'http-ping',
    'The platform’s own classification/extraction engine pair — air-gapped clients.', [url('endpoint', 'Engine endpoint')]),

  /* ================= AI providers ================= */
  conn('ai.anthropic', 'Anthropic', 'data', 'ai', 'none', ['tool', 'test'], ['apiKey'], ['apiKey'], 'http', 'http-ping',
    'Claude models for intent, agents and create-with-AI.', [
      url('endpoint', 'API base', 'https://api.anthropic.com'), txt('model', 'Model', 'claude-sonnet-5'),
    ]),
  conn('ai.openai', 'OpenAI-compatible', 'data', 'ai', 'none', ['tool', 'test'], ['apiKey'], ['apiKey'], 'http', 'http-ping',
    'OpenAI or any OpenAI-compatible endpoint.', [
      url('endpoint', 'API base', 'https://api.openai.com/v1'), txt('model', 'Model', ''),
    ]),
  conn('ai.bedrock', 'AWS Bedrock', 'data', 'ai', 'none', ['tool', 'test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'adapter', 'adapter',
    'Claude and other models via Bedrock in the client’s AWS account.', [txt('region', 'Region', 'us-east-1'), txt('model', 'Model id', '')]),
  conn('ai.vertex', 'Google Vertex AI', 'data', 'ai', 'none', ['tool', 'test'], ['service-account'], ['serviceAccountJson'], 'adapter', 'adapter',
    'Models via Vertex in the client’s GCP project.', [txt('project', 'Project', '', true), txt('region', 'Region', 'us-central1'), txt('model', 'Model id', '')]),
  conn('ai.ollama', 'Ollama (local)', 'data', 'ai', 'none', ['tool', 'test'], ['none'], [], 'http', 'http-ping',
    'BYOS local models for air-gapped deployments.', [url('endpoint', 'Endpoint', 'http://127.0.0.1:11434'), txt('model', 'Model', '')]),

  /* ================= SaaS ================= */
  conn('saas.slack', 'Slack', 'data', 'saas', 'output', ['notify', 'test'], ['bearer', 'none'], ['webhookUrl', 'botToken'], 'http', 'config-only',
    'Exception alerts, SLA breaches and approval pings via incoming webhook.', [
      txt('channel', 'Channel', '#ops'),
    ]),
  conn('saas.teams', 'Microsoft Teams', 'data', 'saas', 'output', ['notify', 'test'], ['none'], ['webhookUrl'], 'http', 'config-only',
    'Alerts as adaptive cards via incoming webhook.', []),
  conn('saas.gsheets', 'Google Sheets', 'data', 'saas', 'both', ['read', 'write', 'test'], ['service-account'], ['serviceAccountJson'], 'adapter', 'adapter',
    'Small-client master data in; summary reports out.', [txt('spreadsheetId', 'Spreadsheet id', '', true), txt('range', 'Range', 'A:Z')]),
  conn('saas.jira', 'Jira', 'data', 'saas', 'output', ['write', 'test'], ['basic', 'bearer'], ['apiToken'], 'http', 'http-ping',
    'Raise exceptions as issues.', [url('endpoint', 'Site URL'), txt('project', 'Project key', '', true), txt('issueType', 'Issue type', 'Task')]),
  conn('saas.servicenow', 'ServiceNow', 'data', 'saas', 'both', ['read', 'write', 'test'], ['basic', 'oauth2-cc'], ['password', 'clientSecret'], 'http', 'http-ping',
    'Enterprise ITSM: incidents and query-desk bridge.', [url('endpoint', 'Instance URL'), txt('table', 'Table', 'incident')]),
  conn('saas.zendesk', 'Zendesk', 'data', 'saas', 'both', ['read', 'write', 'webhook', 'test'], ['apiKey', 'basic'], ['apiToken'], 'http', 'http-ping',
    'Client query desk bridged to tickets.', [url('endpoint', 'Subdomain URL')]),
  conn('saas.salesforce', 'Salesforce', 'data', 'saas', 'both', ['read', 'write', 'test'], ['oauth2-cc', 'oauth2-code'], ['clientSecret'], 'adapter', 'adapter',
    'Customer master resolution and status write-back.', [url('endpoint', 'Instance URL'), txt('object', 'Object', 'Account')]),
  conn('saas.hubspot', 'HubSpot', 'data', 'saas', 'both', ['read', 'write', 'test'], ['bearer'], ['accessToken'], 'http', 'http-ping',
    'Mid-market CRM sync.', [txt('object', 'Object', 'companies')]),

  /* ================= Identity & vaults ================= */
  conn('id.oidc', 'OIDC / SSO', 'data', 'identity', 'none', ['test'], ['oauth2-code'], ['clientSecret'], 'http', 'http-ping',
    'Entra ID / Google Workspace / Okta federation.', [url('issuer', 'Issuer URL'), txt('clientId', 'Client id', '', true)]),
  conn('id.ldap', 'LDAP / Active Directory', 'data', 'identity', 'none', ['test'], ['basic'], ['bindPassword'], 'adapter', 'adapter',
    'BYOS on-prem directory for user sync.', [url('host', 'Host'), num('port', 'Port', 636), txt('baseDn', 'Base DN', '', true)]),
  conn('vault.aws', 'AWS Secrets Manager', 'data', 'vault', 'none', ['test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'adapter', 'adapter',
    'Client-owned key custody behind the platform vault.', [txt('region', 'Region', 'us-east-1')]),
  conn('vault.azkv', 'Azure Key Vault', 'data', 'vault', 'none', ['test'], ['service-principal'], ['clientSecret'], 'adapter', 'adapter',
    'Client-owned key custody behind the platform vault.', [url('vaultUrl', 'Vault URL')]),

  /* ================= Logistics-native ================= */
  conn('log.project44', 'project44', 'data', 'logistics', 'input', ['poll', 'webhook', 'test'], ['oauth2-cc'], ['clientSecret'], 'http', 'http-ping',
    'Container tracking events as a source.', [url('endpoint', 'API base', 'https://na12.api.project44.com')]),
  conn('log.vizion', 'Vizion', 'data', 'logistics', 'input', ['webhook', 'test'], ['apiKey'], ['apiKey'], 'http', 'http-ping',
    'Container tracking subscriptions.', [url('endpoint', 'API base', 'https://api.vizionapi.com')]),
  conn('log.cargowise', 'CargoWise eAdapter', 'data', 'logistics', 'both', ['read', 'write', 'test'], ['basic'], ['password'], 'adapter', 'adapter',
    'TMS read/write over eAdapter.', [url('endpoint', 'eAdapter endpoint')]),

  /* ================= Plane B — infrastructure targets ================= */
  conn('infra.aws', 'AWS target', 'infra', 'infra', 'none', ['provision', 'test'], ['iam-keys', 'iam-role'], ['accessKeyId', 'secretAccessKey'], 'none', 'config-only',
    'Pulumi-provisioned org stack: VPC, compute, RDS Postgres, S3, DNS.', [
      txt('region', 'Region', 'us-east-1'), sel('size', 'Footprint', ['small', 'medium', 'large'], 'small'),
    ]),
  conn('infra.azure', 'Azure target', 'infra', 'infra', 'none', ['provision', 'test'], ['service-principal'], ['clientSecret'], 'none', 'config-only',
    'Pulumi-provisioned org stack: VNet, VM, PG Flexible, Blob, DNS.', [
      txt('location', 'Location', 'westeurope'), sel('size', 'Footprint', ['small', 'medium', 'large'], 'small'),
    ]),
  conn('infra.gcp', 'GCP target', 'infra', 'infra', 'none', ['provision', 'test'], ['service-account'], ['serviceAccountJson'], 'none', 'config-only',
    'Pulumi-provisioned org stack: VPC, GCE, Cloud SQL, GCS, DNS.', [
      txt('project', 'Project', '', true), txt('region', 'Region', 'us-central1'), sel('size', 'Footprint', ['small', 'medium', 'large'], 'small'),
    ]),
  conn('infra.byos', 'Bring-your-own-stack target', 'infra', 'infra', 'none', ['provision', 'test'], ['ssh-key', 'basic'], ['privateKey', 'password'], 'none', 'config-only',
    'Client-supplied host: preflight, compose up, health verify — no cloud provisioning.', [
      url('host', 'Host'), num('port', 'SSH port', 22), txt('user', 'SSH user', 'malkom'),
    ]),
];

export const connectorById = (id: string): ConnectorDescriptor | undefined =>
  CONNECTORS.find((descriptor) => descriptor.id === id);

/** Default config for a connector (field defaults flattened). */
export const connectorDefaults = (id: string): Record<string, unknown> => {
  const descriptor = connectorById(id);
  if (descriptor === undefined) return {};
  return Object.fromEntries(descriptor.cfg.map((field) => [field.k, field.d]));
};

export interface ConnectorUsage {
  /** what this connector is for */
  overview: string;
  /** ordered setup steps */
  setup: string[];
  /** how "Test connection" behaves, incl. without a client runtime */
  testing: string;
  /** how execution happens at runtime */
  execution: string;
  /** what this connector expects to receive */
  input: string;
  /** what it produces / hands back */
  output: string;
  /** a payload shape worth trying in the sandbox */
  samplePayload: Record<string, unknown>;
}

/** A generated usage manual for a connector, derived from its own
 *  metadata so it never drifts from the descriptor. */
export const usageFor = (descriptor: ConnectorDescriptor): ConnectorUsage => {
  const required = descriptor.cfg.filter((field) => field.req === true).map((field) => field.l);
  const optional = descriptor.cfg.filter((field) => field.req !== true).map((field) => field.l);
  const setup: string[] = [];
  setup.push(
    descriptor.plane === 'infra'
      ? 'Create it as a deployment target for the organization (Connections → it lands in the Deployment targets lane).'
      : 'Create a connection for the organization, or try it first in the sandbox without any org.',
  );
  if (required.length > 0) setup.push(`Fill the required field(s): ${required.join(', ')}.`);
  if (optional.length > 0) setup.push(`Optional field(s): ${optional.join(', ')}.`);
  if (descriptor.secretSlots.length > 0) {
    setup.push(
      `Credentials: store the secret in the platform vault and reference its key (slot(s): ${descriptor.secretSlots.join(', ')}; auth: ${descriptor.auth.join(' / ')}). Values are never stored on the connection.`,
    );
  } else {
    setup.push('No credentials needed.');
  }
  setup.push('Save, then Test — and once healthy, the org\'s next setup apply pushes it to the client-side engine.');

  const testing =
    descriptor.test === 'http-ping'
      ? 'Test pings the configured endpoint over HTTP from the command center — no org runtime needed. Any response below HTTP 500 counts as reachable.'
      : descriptor.test === 'config-only'
        ? 'Test validates the configuration and checks that every secret reference resolves — no network call, works entirely without a client runtime.'
        : descriptor.test === 'custom-op'
          ? 'Test runs the custom definition\'s designated test operation against the real API — no org runtime needed.'
          : 'A live test needs the runtime adapter that ships beside the client plane; from the command center the test reports DEGRADED with the reason. Configuration and secrets are still validated.';

  const execution =
    descriptor.execution === 'http'
      ? 'Executes natively over HTTP wherever the engine runs — in the command center for verification, and in the org\'s provisioned engine for production.'
      : descriptor.execution === 'staged'
        ? 'Deliveries are staged PREPARED with the rendered payload; the host transport (which holds the credentials) collects and completes them, then marks the run collected.'
        : descriptor.execution === 'custom'
          ? 'Executes the declarative operations of its custom definition (Custom connectors tab) — pick the operation when executing.'
          : descriptor.execution === 'adapter'
            ? 'Executes through the runtime adapter deployed with the client plane. Without the adapter, runs fail loudly with "no adapter registered".'
            : descriptor.plane === 'infra'
              ? 'Consumed by the provisioner: the target\'s config and credentials drive infrastructure provisioning and deploys — nothing executes inside the integration engine itself.'
              : 'Configuration-only: the host serves this endpoint (inbound API/webhook routes) using the connection\'s settings.';

  const receives = descriptor.direction === 'input' || descriptor.direction === 'both';
  const emits = descriptor.direction === 'output' || descriptor.direction === 'both';

  const input =
    descriptor.plane === 'infra'
      ? 'No runtime payload. It consumes its own configuration (region/host/footprint) plus the vault-held credentials when the provisioner runs.'
      : descriptor.capabilities.includes('notify')
        ? 'A JSON object; a `text` field is used as the message body when present, otherwise the whole object is sent.'
        : descriptor.execution === 'custom'
          ? 'A JSON object whose keys fill the `{placeholders}` in the selected operation\'s path and body template.'
          : emits
            ? 'A JSON object — the task result to deliver. Binding field mappings rewrite it into the shape the destination expects before it is sent.'
            : receives
              ? 'Nothing is pushed in: the connector pulls (or is called) and each item it retrieves becomes one task payload.'
              : 'A JSON object describing the request for this provider (model input, query, or document reference).';

  const output =
    descriptor.plane === 'infra'
      ? 'Provisioned infrastructure and its outputs (endpoints, connection references) handed to the deployment bundle.'
      : descriptor.execution === 'staged'
        ? 'A PREPARED run holding the rendered payload — the host transport delivers it, then marks the run collected. No response body is returned.'
        : descriptor.execution === 'custom'
          ? 'The operation\'s response, narrowed to the configured response path; returned on the run and stored in the ledger.'
          : receives && !emits
            ? 'One task payload per retrieved item, plus a RECEIVE run in the ledger recording what was pulled.'
            : 'A run record with OK/FAILED status, the transport detail (HTTP status or error), and the attempt count. Failures retain the payload for redelivery.';

  const samplePayload: Record<string, unknown> = descriptor.capabilities.includes('notify')
    ? { text: 'SLA breach on queue DOC-INTAKE — 3 tasks overdue' }
    : descriptor.execution === 'custom'
      ? { container: 'MSKU1234567' }
      : descriptor.plane === 'infra'
        ? {}
        : { taskId: 'TASK-1001', queue: 'doc-intake', fields: { bookingNumber: 'BKG-88213', vessel: 'EVER GIVEN' } };

  return {
    overview: `${descriptor.name} — ${descriptor.blurb} (${descriptor.plane} plane · ${descriptor.category} · ${descriptor.provider} family · direction: ${descriptor.direction}).`,
    setup,
    testing,
    execution,
    input,
    output,
    samplePayload,
  };
};

export interface ConfigValidation {
  ok: boolean;
  errors: string[];
  /** input merged over field defaults, unknown keys preserved */
  value: Record<string, unknown>;
}

/** Validate a config object against a descriptor's field metadata. */
export const validateConfig = (descriptor: ConnectorDescriptor, input: Record<string, unknown>): ConfigValidation => {
  const errors: string[] = [];
  const value: Record<string, unknown> = { ...connectorDefaults(descriptor.id), ...input };
  for (const field of descriptor.cfg) {
    const raw = value[field.k];
    if (field.req === true && (raw === undefined || raw === null || raw === '')) {
      errors.push(`${field.l} is required`);
      continue;
    }
    if (raw === undefined || raw === null) continue;
    if (field.t === 'num' && typeof raw !== 'number') errors.push(`${field.l} must be a number`);
    if (field.t === 'tog' && typeof raw !== 'boolean') errors.push(`${field.l} must be a boolean`);
    if ((field.t === 'text' || field.t === 'area') && typeof raw !== 'string') errors.push(`${field.l} must be a string`);
    if (field.t === 'select' && (typeof raw !== 'string' || (field.o !== undefined && !field.o.includes(raw)))) {
      errors.push(`${field.l} must be one of: ${(field.o ?? []).join(', ')}`);
    }
    if (field.t === 'chips' && (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string'))) {
      errors.push(`${field.l} must be a list of strings`);
    }
  }
  return { ok: errors.length === 0, errors, value };
};
