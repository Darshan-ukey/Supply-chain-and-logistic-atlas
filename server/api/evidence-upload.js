'use strict';const {json}=require('./_utils');module.exports=(req,res)=>json(res,410,{ok:false,error:'Persistent raw evidence upload is disabled in Pilot V1.0 session-ephemeral document mode.'});
