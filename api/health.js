'use strict';const {json}=require('./_utils');module.exports=(req,res)=>json(res,200,{ok:true,status:'UP',service:'scoip',release:'foundation-v1.1',time:new Date().toISOString()});
