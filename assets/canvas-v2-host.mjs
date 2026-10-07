// Host-only adapter: the frozen renderer keeps its private state and package bytes.
// Its playbar publishes the canonical active process ID even in Trace mode.
globalThis.S = { activeModule: 'road-ltl', selectedProcess: null };
const bridge = await import('/assets/canvas-daughter-bridge-v2.0.1.mjs');
const [registryResponse, moduleResponse] = await Promise.all([
  fetch(bridge.TARGET_REGISTRY_PATH), fetch('/data/modules/road-ltl-v1.2.json')
]);
if (!registryResponse.ok || !moduleResponse.ok) throw new Error('Canvas host context unavailable');
const registry = await registryResponse.json();
if (registry.status !== 'ACTIVE_P4_INTEGRATION_CONTRACT') throw new Error('Canvas target registry inactive');
const module = await moduleResponse.json();
const ids = new Set(module.processes.map(p => p.id));
const refresh = () => {
  const id = document.getElementById('playMetaText')?.textContent.split(' · ')[0];
  globalThis.S.selectedProcess = ids.has(id) ? id : null;
  bridge.decorateCanvasInspector(registry, globalThis.S);
};
const observer = new MutationObserver(refresh);
observer.observe(document.getElementById('playMetaText'), { childList: true, characterData: true, subtree: true });
observer.observe(document.getElementById('inspectorBody'), { childList: true });
refresh();
globalThis.AtlasCanvasV2Host = { refresh, observer, rendererVersion: '2.0.0', bridgeVersion: bridge.CANVAS_DAUGHTER_BRIDGE_VERSION };
const { installRelationshipDisclosure } = await import('/assets/canvas-v2-relationships.mjs');
globalThis.AtlasCanvasV2Host.relationships = installRelationshipDisclosure(module, {sourcePath:'/data/modules/road-ltl-v1.2.json'});
