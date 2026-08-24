'use strict';const {json}=require('./_utils');module.exports=(req,res)=>json(res,200,{ok:true,mode:'SESSION_EPHEMERAL',documents:[],message:'Pilot V1.0 does not retain uploaded source documents.'});
