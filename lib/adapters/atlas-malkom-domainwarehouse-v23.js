const clone = (v) => JSON.parse(JSON.stringify(v));
const text = (v) => {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (v && typeof v === 'object') return JSON.stringify(v);
  return 'UNRESOLVED';
};
const firstText = (arr) => Array.isArray(arr) && arr.length ? text(arr[0]) : 'UNRESOLVED';
const listText = (arr) => Array.isArray(arr) ? arr.map(text) : [];
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const check = (ok, code) => { if (!ok) throw new Error(code); };

export function adaptAtlasProjectionToMalkomV23(atlasProjection, consumerProfile, options={}) {
  check(atlasProjection?.schemaVersion === 'atlas-malkom-projection-boundary-v1.0','ATL169_SCHEMA_REQUIRED');
  check(atlasProjection?.consumer === 'MALKOM','MALKOM_CONSUMER_REQUIRED');
  check(atlasProjection?.canonicalBoundary?.canonicalMutation === false,'CANONICAL_MUTATION_FORBIDDEN');
  check(atlasProjection?.canonicalBoundary?.failClosed === true,'FAIL_CLOSED_REQUIRED');

  const wd = atlasProjection?.payload?.canonicalWorkDefinition;
  check(wd?.schemaVersion === 'atlas-canonical-workdefinition-v1','P62_WORKDEFINITION_REQUIRED');
  check(consumerProfile?.taskId === wd?.lineage?.sourceTaskId,'PROFILE_TASK_MISMATCH');
  check(Array.isArray(consumerProfile?.subQueues) && consumerProfile.subQueues.length>0,'PROFILE_SUBQUEUES_REQUIRED');
  check(Array.isArray(consumerProfile?.workTypes) && consumerProfile.workTypes.length>0,'PROFILE_WORKTYPES_REQUIRED');
  check(Array.isArray(consumerProfile?.fields) && consumerProfile.fields.length>0,'PROFILE_FIELDS_REQUIRED');
  check(Array.isArray(consumerProfile?.outcomes) && consumerProfile.outcomes.length>0,'PROFILE_OUTCOMES_REQUIRED');

  const profileCompatibility = options.profileCompatibility || 'UNVERIFIED_HISTORICAL_CONSUMER_PROFILE';
  const profileId = options.profileId || `malkom-profile:${consumerProfile.taskId}`;
  const profileSha256 = options.profileSha256 || 'UNPINNED';
  const sourceRefs = clone(wd.provenance?.sourceRefs || []);
  const outputState = wd.executionCharacteristics?.outputState;
  const outputs = Array.isArray(outputState) ? outputState.map(text) : (outputState ? [text(outputState)] : []);

  const mappedProfile = clone(consumerProfile);
  mappedProfile.taskId = wd.lineage.sourceTaskId;
  mappedProfile.taskLabel = wd.title;
  mappedProfile.sourceRefs = sourceRefs;
  mappedProfile.decisions = clone(wd.decisions || []);
  mappedProfile.rules = listText(wd.rules);
  mappedProfile.controls = listText(wd.controls);
  mappedProfile.actions = listText(wd.actions);
  mappedProfile.actors = listText(wd.actors);
  mappedProfile.systems = clone(wd.systems || []);

  const definition = {
    kind:'malkom.domain-work-definition/2.3',
    id:`atlas:${wd.workDefinitionId}`,
    domain:`supply-chain.${wd.lineage.daughterModule}`,
    version:wd.version,
    status:'VALIDATED',
    canonicalName:wd.title,
    sourceTask:{
      module:`${wd.lineage.daughterModule}@${wd.lineage.daughterVersion}`,
      taskId:wd.lineage.sourceTaskId,
      normalizedSourceSha256:wd.provenance.governedInputContentHash,
      sourceRefs
    },
    sourceRecord:{
      atlasCanonical:{
        workDefinitionId:wd.workDefinitionId,
        workDefinitionVersion:wd.version,
        contractVersion:wd.contractVersion,
        sourceWorkUnitId:wd.lineage.sourceWorkUnitId,
        governedInputContentHash:wd.provenance.governedInputContentHash,
        projectionHandoffId:atlasProjection.handoffId
      },
      adapterProfile:{id:profileId,sha256:profileSha256,compatibility:profileCompatibility},
      paths:{},
      blockers:clone(atlasProjection.readiness?.blockers || []),
      dispositions:clone(atlasProjection.dispositions || {})
    },
    sourceGraph:{
      incoming:[],outgoing:[],
      executionTransition:{
        id:`atlas-transition:${wd.lineage.sourceWorkUnitId}`,
        processId:wd.lineage.sourceTaskId,
        stateBeforeId:firstText(wd.dependencies),
        eventId:text(wd.trigger),
        decisionId:firstText(wd.decisions),
        ruleId:firstText(wd.rules),
        controlId:firstText(wd.controls),
        clock:firstText(wd.clocks),
        actionId:firstText(wd.actions),
        evidenceId:firstText(wd.evidence),
        stateAfterId:outputs.length ? outputs.join(' | ') : 'UNRESOLVED'
      }
    },
    canonical:{
      execution:{
        trigger:text(wd.trigger),
        stateBefore:firstText(wd.dependencies),
        event:text(wd.trigger),
        decision:firstText(wd.decisions),
        rule:firstText(wd.rules),
        control:firstText(wd.controls),
        clock:firstText(wd.clocks),
        action:firstText(wd.actions),
        evidence:firstText(wd.evidence),
        stateAfter:outputs.length ? outputs.join(' | ') : 'UNRESOLVED',
        outcome:firstText(wd.outcomes)
      },
      actors:{actor:'UNRESOLVED',performer:'UNRESOLVED',owner:'UNRESOLVED',decisionAuthority:'UNRESOLVED',custody:'UNRESOLVED',financial:'UNRESOLVED',exceptionOwner:'UNRESOLVED'},
      systems:{producer:'UNRESOLVED',authoritySystem:'UNRESOLVED',authorityObject:'UNRESOLVED',consumers:'UNRESOLVED',interface:'UNRESOLVED'},
      information:{inputs:listText(wd.inputs),outputs,identifiers:'UNRESOLVED',lineage:`${wd.workDefinitionId}@${wd.version} <- ${wd.provenance.governedInputContentHash}`},
      applicability:clone(wd.applicability || {}),
      participants:[],
      paths:{},
      claimBoundary:`Atlas canonical semantics are authoritative. Consumer profile ${profileId} is ${profileCompatibility} and cannot promote or replace canonical truth.`,
      sourceIds:sourceRefs,
      confidenceModel:{atlasCanonical:'GOVERNED',consumerProfile:profileCompatibility}
    },
    decomposition:{basis:'MALKOM_STANDARD',malkom:mappedProfile},
    notes:[
      {id:`${wd.lineage.sourceTaskId}:adapter:definition`,kind:'DEFINITION',nodeRef:{kind:'QUEUE',id:mappedProfile.queue},text:`Consumer structure adapted from ${profileId}; Atlas canonical semantics remain authoritative.`,provenance:'ATLAS_DERIVED',sourceRefs,confidence:'MEDIUM'},
      {id:`${wd.lineage.sourceTaskId}:adapter:source`,kind:'SOURCE',nodeRef:{kind:'RULE',id:`${wd.lineage.sourceTaskId}:atlas-source`},text:`Atlas WorkDefinition ${wd.workDefinitionId}@${wd.version}; governed input ${wd.provenance.governedInputContentHash}.`,provenance:'ATLAS_DERIVED',sourceRefs,confidence:'HIGH'},
      {id:`${wd.lineage.sourceTaskId}:adapter:profile`,kind:'OPEN_QUESTION',nodeRef:{kind:'CONTROL',id:`${wd.lineage.sourceTaskId}:profile-compatibility`},text:`Malkom profile compatibility state: ${profileCompatibility}; profile SHA256 ${profileSha256}.`,provenance:'UNRESOLVED',sourceRefs,confidence:'UNRESOLVED'}
    ],
    projections:[{
      id:`malkom:${wd.lineage.sourceTaskId}:atl191-proof`,runtime:'MALKOM_3',adapterId:'atlas-malkom-domainwarehouse-v23',generatedFromWorkDefinitionId:wd.workDefinitionId,
      disposition:atlasProjection.release?.materializable ? 'MAPPED' : (atlasProjection.readiness?.clientBindings?.unresolvedCount ? 'CLIENT_BINDING_REQUIRED' : 'UNSUPPORTED_CURRENT_MALKOM'),
      capabilities:['QUEUE','SUBQUEUE','WORK_TYPE','SCHEMA','OUTCOME','VALUE_LIST','WORKFLOW'],
      payloadRef:`proof:${profileId}`,
      note:'ATL-191 bounded proof only. Final materialization remains governed by Atlas readiness plus consumer-profile compatibility.'
    }],
    clientOverridePoints:uniq([...(consumerProfile.clientOverridePoints||[]),...(wd.clientBindingRequirements||[])]),
    provenance:{sourceRecord:'ATLAS_DERIVED',canonical:'ATLAS_DERIVED',decomposition:'MALKOM_STANDARD',projection:'MALKOM_STANDARD'}
  };

  const upstreamBlocked = atlasProjection.release?.materializable !== true || atlasProjection.readiness?.universalExecutionReady !== true;
  const profileVerified = profileCompatibility === 'VERIFIED_CURRENT_CONSUMER_PROFILE';
  return {
    definition,
    assessment:{
      adapter:'atlas-malkom-domainwarehouse-v23',
      canonicalMutation:false,
      profileId,profileSha256,profileCompatibility,
      upstreamBlocked,
      profileVerified,
      finalMaterializable:false,
      reason:upstreamBlocked ? 'ATLAS_UPSTREAM_NOT_MATERIALIZABLE' : (!profileVerified ? 'CONSUMER_PROFILE_NOT_VERIFIED' : 'REQUIRES_ENGINE_COMPILATION')
    }
  };
}
