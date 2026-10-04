import {createRouter} from '../lib/api/_router.js';
export default createRouter('atlas',{
  'ask-atlas':'./ask-atlas.js',
  'command-validate':'./command-validate.js',
  'execution-depth-projection':'./execution-depth-projection.js',
  'governed-depth-summary':'./governed-depth-summary.js',
  'governance-operational-projection':'./governance-operational-projection.js',
  'work-decomposition':'./work-decomposition.js',
  'admin-workdefinitions':'./admin-workdefinitions.js',
  'runtime-access':'./runtime-access.js',
  'malkom-projections':'./malkom-projections.js'
});
