import {buildSimulation} from '../../../lib/simulation/engine.js';
import {verifyModelIntegrity} from '../../../lib/atlas/store.js';
export async function GET(){const integrity=verifyModelIntegrity();if(!integrity.ok)return Response.json({error:'Atlas integrity check failed.',integrity},{status:503});return Response.json(buildSimulation())}
export async function POST(req){try{const integrity=verifyModelIntegrity();if(!integrity.ok)return Response.json({error:'Atlas integrity check failed.',integrity},{status:503});const body=await req.json();return Response.json(buildSimulation({context:body?.context||{},workspace:body?.workspace||{}}))}catch(e){return Response.json({error:'Simulation failed safely.',detail:String(e.message||e)},{status:400})}}
export async function PUT(){return Response.json({error:'Read-only simulation endpoint.'},{status:405})}export const PATCH=PUT;export const DELETE=PUT;
