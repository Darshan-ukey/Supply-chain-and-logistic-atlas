import crypto from 'crypto';
import {insert,select,supabaseCapability} from '../persistence/supabase.js';
const memory=[];
export async function logEvent(event){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...event};memory.push(row);if(memory.length>500)memory.shift();try{await insert('atlas_events',row)}catch{}return row}
export async function telemetrySummary(){let rows=memory;try{const s=await select('atlas_events','select=*&order=created_at.desc&limit=500');if(s.status==='OK')rows=s.rows}catch{}const counts={};for(const r of rows)counts[r.event_type]=(counts[r.event_type]||0)+1;return {capability:supabaseCapability(),events:rows.length,counts,recent:rows.slice(-25).reverse()}}
