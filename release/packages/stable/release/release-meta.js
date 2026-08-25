export const RELEASE_META=Object.freeze({
  stage:'v1.1.8',
  releaseId:'scoip-v1.1.8-governed-composition-2026.08.25',
  product:'Supply Chain Operations Intelligence Platform',
  activeDomainPack:'supply-chain',
  canonicalModule:'road-ltl@1.2',
  sourceStage:'Exact v1.1.7 final + governed Page-0 composition sidecar + four entry routes + Road LTL execution-role refinement',
  nodeRuntime:'24.x',
  releaseContract:'atlas-release-contract-v1',
  parityContract:'stage23-full-product-parity-v1',
  compositionContract:'page0-governed-composition-v1.1.8',
  builtAt:'2026-08-25T09:54:00+05:30'
});
export function releaseRuntime(){const channel=String(process.env.ATLAS_RELEASE_CHANNEL||'lab').toLowerCase();return {...RELEASE_META,channel:['stable','lab'].includes(channel)?channel:'invalid',vercelEnv:process.env.VERCEL_ENV||'local',commitSha:process.env.VERCEL_GIT_COMMIT_SHA||null,productionUrl:process.env.VERCEL_PROJECT_PRODUCTION_URL||null}}
