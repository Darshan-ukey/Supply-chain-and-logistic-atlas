'use strict';const {json,clearCookie}=require('./_utils');module.exports=(req,res)=>{clearCookie(res,'atlas_access_token');clearCookie(res,'atlas_refresh_token');json(res,200,{ok:true})};
