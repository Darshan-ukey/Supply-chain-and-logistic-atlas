import crypto from 'crypto';
import {insert,select,patch,supabaseCapability} from '../persistence/supabase.js';
const memory=[];
export async function createReviewItem(item){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),status:'OPEN',...item};memory.push(row);try{await insert('atlas_review_items',row)}catch{}return row}
export async function listReviewItems(){try{const r=await select('atlas_review_items','select=*&order=created_at.desc&limit=200');if(r.status==='OK')return {capability:supabaseCapability(),items:r.rows}}catch{}return {capability:supabaseCapability(),items:[...memory].reverse()}}
export async function resolveReviewItem(id,status,notes=''){const allowed=['APPROVED','REJECTED','EDIT_REQUIRED','NEEDS_EVIDENCE','UNRESOLVED'];if(!allowed.includes(status))throw new Error('Invalid review status');const i=memory.findIndex(x=>x.id===id);if(i>=0)memory[i]={...memory[i],status,review_notes:notes,resolved_at:new Date().toISOString()};try{await patch('atlas_review_items',`id=eq.${encodeURIComponent(id)}`,{status,review_notes:notes,resolved_at:new Date().toISOString()})}catch{}return i>=0?memory[i]:{id,status,review_notes:notes}}
