import {createRouter} from '../lib/api/_router.js';
import executionDepthProjection from '../lib/api/execution-depth-projection.js';
import askAtlas from '../lib/api/ask-atlas.js';
import commandValidate from '../lib/api/command-validate.js';
import governedDepthSummary from '../lib/api/governed-depth-summary.js';
import governanceOperationalProjection from '../lib/api/governance-operational-projection.js';
import workDecomposition from '../lib/api/work-decomposition.js';
import adminWorkdefinitions from '../lib/api/admin-workdefinitions.js';
import runtimeAccess from '../lib/api/runtime-access.js';
import malkomProjections from '../lib/api/malkom-projections.js';
export default createRouter('atlas',{
  'ask-atlas':askAtlas,
  'command-validate':commandValidate,
  'execution-depth-projection':executionDepthProjection,
  'governed-depth-summary':governedDepthSummary,
  'governance-operational-projection':governanceOperationalProjection,
  'work-decomposition':workDecomposition,
  'admin-workdefinitions':adminWorkdefinitions,
  'runtime-access':runtimeAccess,
  'malkom-projections':malkomProjections
});
