// REM-034: host-only correction; frozen Canvas V2.0 package remains byte-identical.
// The frozen renderer exposes selectStage as a global function declaration.
// Replace only its host binding after the frozen script has initialized.
(function () {
  'use strict';
  if (typeof selectStage !== 'function' || typeof currentStages !== 'function' ||
      typeof depthStages !== 'function' || typeof renderAll !== 'function') {
    throw new Error('REM-034 host override: frozen Canvas contract unavailable');
  }
  selectStage = function selectStageHostDerived(displayIndex) {
    const journey = currentStages();
    const visible = depthStages(journey);
    const selected = visible[displayIndex];
    if (!selected || !Array.isArray(selected.processIds) || !selected.processIds.length) return;
    // A2 grouped nodes choose the final declared process, matching legacy selection.
    // A4/A5 nodes have exactly one process. Never use the display index as journey index.
    const processId = selected.processIds[selected.processIds.length - 1];
    const journeyIndex = journey.findIndex(stage => stage.processIds.includes(processId));
    if (journeyIndex < 0) throw new Error('REM-034: selected process missing from canonical journey: ' + processId);
    state.stageIndex = journeyIndex;
    state.selectedProcessId = processId;
    if (state.trace) {
      const traceIndex = state.trace.steps.findIndex(step => step.processId === processId);
      if (traceIndex >= 0) state.trace.focus = traceIndex;
    }
    renderAll();
  };
})();
