'use strict';const {json}=require('./_utils');module.exports=(req,res)=>json(res,200,{ok:true,status:'UP',service:'scoip',release:'pilot-v1.0',time:new Date().toISOString()});
