import {getConstitution,constitutionSummary} from '../../../lib/atlas/constitution.js';
export async function GET(req){const url=new URL(req.url),full=url.searchParams.get('full')==='1';return Response.json(full?getConstitution():constitutionSummary())}
