export const RELEASE_META=Object.freeze({
  stage:'v2.0.1',
  releaseId:'supply-chain-atlas-v2-universal-ask-2026.09.01',
  product:'Supply Chain Atlas 2.0 — Execution Intelligence + Universal Ask Atlas',
  activeDomainPack:'supply-chain',
  canonicalModule:'road-ltl@1.2',
  sourceStage:'V1.1.8-compatible spatial foundation + V6.2.3 Page 0 + Road LTL V1.2 + Intelligence v0.6.6 + V2 WorkDefinition layer + Universal Ask Atlas runtime',
  nodeRuntime:'24.x',
  releaseContract:'atlas-v2.0.1-universal-ask-contract-v1',
  parityContract:'v1.1.8-protected-baseline-plus-v2-additive',
  accessModel:'public-summary-plus-authenticated-admin-execution-layer',
  builtAt:'2026-09-01T14:55:00+05:30'
});
export function releaseRuntime(){const channel=String(process.env.ATLAS_RELEASE_CHANNEL||'lab').toLowerCase();return {...RELEASE_META,channel:['stable','lab'].includes(channel)?channel:'invalid',vercelEnv:process.env.VERCEL_ENV||'local',commitSha:process.env.VERCEL_GIT_COMMIT_SHA||null,productionUrl:process.env.VERCEL_PROJECT_PRODUCTION_URL||null}}
