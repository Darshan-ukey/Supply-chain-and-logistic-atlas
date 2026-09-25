/** Pseudocode integration seam for the future malkom-command host. */
export const domainWarehouseRoutes = {
  listDomains: 'GET /api/domain-warehouse/domains',
  getDomain: 'GET /api/domain-warehouse/domains/:domainId',
  coverage: 'GET /api/domain-warehouse/coverage',
  validate: 'POST /api/domain-warehouse/validate',
  materialize: 'POST /api/domain-warehouse/materialize',
  publish: 'POST /api/domain-warehouse/publish'
} as const;
