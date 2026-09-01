export const RELEASE_META=Object.freeze({
  stage:'v1.1.7',
  releaseId:'scoip-v1.1.7-reference-parity-2026.08.24',
  product:'Supply Chain Operations Intelligence Platform',
  activeDomainPack:'supply-chain',
  canonicalModule:'road-ltl@1.2',
  sourceStage:'Legacy V6.2.3 + Road LTL V1.2 + Intelligence v0.6.6 + Stage 23 + Foundation v1.1 + v1.1.6 release certification + v1.1.7 Reference Atlas restoration',
  nodeRuntime:'24.x',
  releaseContract:'atlas-release-contract-v1',
  parityContract:'stage23-full-product-parity-v1',
  builtAt:'2026-08-24T17:04:00+05:30'
});
export function releaseRuntime(){const channel=String(process.env.ATLAS_RELEASE_CHANNEL||'lab').toLowerCase();return {...RELEASE_META,channel:['stable','lab'].includes(channel)?channel:'invalid',vercelEnv:process.env.VERCEL_ENV||'local',commitSha:process.env.VERCEL_GIT_COMMIT_SHA||null,productionUrl:process.env.VERCEL_PROJECT_PRODUCTION_URL||null}}
