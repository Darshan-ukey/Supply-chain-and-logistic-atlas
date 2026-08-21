import {validateWorkspace,validateProcessOrder} from '../../../../lib/scenario/validator.js';
export async function POST(req){const ws=await req.json();const base=validateWorkspace(ws);const order=validateProcessOrder(ws?.reference?.processIds||[]);return Response.json({...base,order})}
export async function PUT(){return Response.json({error:'Frozen Atlas mutation is prohibited.'},{status:405})}
export const PATCH=PUT;export const DELETE=PUT;
