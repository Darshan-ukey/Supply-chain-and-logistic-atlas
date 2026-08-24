export const RELEASE_META=Object.freeze({
  stage:'v1.1.6',
  releaseId:'scoip-v1.1.6-release-certified-2026.08.24',
  product:'Supply Chain Operations Intelligence Platform',
  activeDomainPack:'supply-chain',
  canonicalModule:'road-ltl@1.2',
  sourceStage:'Stage 23 + Foundation v1.1 + Function Consolidation v1.1.3 + Integrity Guards v1.1.5 + Release Certification v1.1.6',
  nodeRuntime:'24.x',
  releaseContract:'atlas-release-contract-v1',
  parityContract:'stage23-full-product-parity-v1',
  builtAt:'2026-08-24T17:04:00+05:30'
});
export function releaseRuntime(){const channel=String(process.env.ATLAS_RELEASE_CHANNEL||'lab').toLowerCase();return {...RELEASE_META,channel:['stable','lab'].includes(channel)?channel:'invalid',vercelEnv:process.env.VERCEL_ENV||'local',commitSha:process.env.VERCEL_GIT_COMMIT_SHA||null,productionUrl:process.env.VERCEL_PROJECT_PRODUCTION_URL||null}}
