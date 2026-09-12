import {createRouter} from '../lib/api/_router.js';
import askAtlas from '../lib/api/ask-atlas.js';
import commandValidate from '../lib/api/command-validate.js';
import executionDepthProjection from '../lib/api/execution-depth-projection.js';
export default createRouter('atlas',{'ask-atlas':askAtlas,'command-validate':commandValidate,'execution-depth-projection':executionDepthProjection});
