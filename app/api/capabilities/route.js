import {capabilityManifest} from '../../../lib/runtime/capabilities.js';export async function GET(){return Response.json(capabilityManifest())}
