import {createMalkomIntegrationService} from './malkom-integration-service.js';
import {loadMalkomDomainWarehouseEngine} from './malkom-engine-provider.js';

let cached=null;
export async function getMalkomIntegrationService(options={}){
  if(options.service)return options.service;
  if(!cached||options.reload){
    const engine=await loadMalkomDomainWarehouseEngine(options);
    cached=createMalkomIntegrationService(engine);
  }
  return cached;
}
