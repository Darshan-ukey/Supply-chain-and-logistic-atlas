# Supply Chain Atlas — Portfolio Prioritization & Impact Trace

- Workspace: Synthetic Demo Client
- Atlas module: Road LTL / Groupage
- Workspace schema: client-as-is-mapping-v0.4
- Active validated opportunities: 3

> Governance: prioritization is a transparent helper derived only from consultant-entered 1–5 ratings. Impact trace uses declared execution edges and A5 contract overlap. No ROI, savings, transaction volume, implementation cost, or causal business impact is inferred.

## Prioritization method
- Value = 65% business impact + 35% reusability
- Deliverability = 55% feasibility + 30% inverse complexity + 15% inverse control sensitivity
- Portfolio index = normalized average of Value and Deliverability

### 1. OP-1787396915486-692I — Time-window dependency · Classify, rate and commit the commercial offer
- Value: 4.7/5
- Deliverability: 4.0/5
- Portfolio index: 87/100
- Derived quadrant: Fast-track
- Intervention: Event-driven alerts
- Consultant priority: HIGH

### 2. OP-1787396915496-6T1F — Reconciliation dependency · Create and validate shipment, consignment and transport-document identity
- Value: 4.3/5
- Deliverability: 3.0/5
- Portfolio index: 74/100
- Derived quadrant: Strategic
- Intervention: Deterministic validation rules
- Consultant priority: MEDIUM

### 3. OP-1787396915449-RW64 — Cross-system authority handoff · Resolve service demand and execution eligibility
- Value: 3.0/5
- Deliverability: 3.0/5
- Portfolio index: 60/100
- Derived quadrant: Review
- Intervention: API/event synchronization
- Consultant priority: MEDIUM

## Selected portfolio interactions
### OP-1787396915486-692I ↔ OP-1787396915496-6T1F
- Execution dependency: LTL-02 precedes LTL-03
- Shared objects: obj-rate, obj-contract, obj-product-master
- Shared systems: None
- Classification: Derived portfolio interaction signal

### OP-1787396915486-692I ↔ OP-1787396915449-RW64
- Execution dependency: LTL-01 precedes LTL-02
- Shared objects: obj-transport-service-request, obj-contract, obj-product-master
- Shared systems: None
- Classification: Derived portfolio interaction signal

### OP-1787396915496-6T1F ↔ OP-1787396915449-RW64
- Execution dependency: LTL-01 precedes LTL-03
- Shared objects: obj-order, obj-contract, obj-product-master, obj-shipment
- Shared systems: sys-tms
- Classification: Derived portfolio interaction signal

## Impact trace — OP-1787396915486-692I
- A5 task: LTL-02 — Classify, rate and commit the commercial offer
- Upstream within 2 hops: LTL-01
- Downstream within 2 hops: LTL-03, LTL-04
- Canonical objects: obj-transport-service-request, obj-rate, obj-contract, obj-product-master, obj-quote, obj-freight-charge
- Systems: sys-rate-engine / sys-cpq, sys-rate-engine, sys-tms / sys-billing / customer channel
- Related active opportunities: OP-1787396915496-6T1F, OP-1787396915449-RW64

> Structural impact scope is an inspection aid, not proof that each related process will change.
