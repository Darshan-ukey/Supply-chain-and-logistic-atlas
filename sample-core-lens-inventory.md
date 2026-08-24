# Stage 12 — Core Atlas Lens Inventory

> This inventory is generated from the Road LTL V1.2 data contract. Lenses expose declared relationships only; they do not create new taxonomy or process knowledge.

## Actors
- 15 declared actors participate in at least one A5 task.
- **Operating carrier** (`actor-operating-carrier`): 22 A5 touchpoints
- **Shipper / BCO** (`actor-shipper`): 12 A5 touchpoints
- **3PL** (`actor-3pl`): 7 A5 touchpoints
- **Warehouse / terminal operator** (`actor-warehouse-operator`): 5 A5 touchpoints
- **4PL / LLP** (`actor-4pl`): 3 A5 touchpoints
- **Consignee / receiving party** (`actor-consignee`): 2 A5 touchpoints
- **Customer / entitled party** (`actor-customer`): 2 A5 touchpoints
- **Freight forwarder** (`actor-forwarder`): 2 A5 touchpoints
- **Pricing / rating authority** (`actor-pricing`): 2 A5 touchpoints
- **Billing, audit, AR/AP or treasury** (`actor-finance`): 1 A5 touchpoints
- **Claims / dispute function** (`actor-claims`): 1 A5 touchpoints
- **Competent authority** (`actor-competent-authority`): 1 A5 touchpoints
- **Customs broker** (`actor-customs-broker`): 1 A5 touchpoints
- **Data steward** (`actor-data-steward`): 1 A5 touchpoints
- **Insurer / recovery party** (`actor-insurer`): 1 A5 touchpoints

## Systems
- 35 canonical `sys-*` tokens are declared across producer, authority and consumer fields.
- **sys-tms**: 20 A5 touchpoints
- **sys-wms**: 11 A5 touchpoints
- **sys-billing**: 8 A5 touchpoints
- **sys-carrier-platform**: 8 A5 touchpoints
- **sys-crm**: 6 A5 touchpoints
- **sys-dispatch**: 6 A5 touchpoints
- **sys-claims**: 5 A5 touchpoints
- **sys-customer-portal**: 5 A5 touchpoints
- **sys-dms**: 5 A5 touchpoints
- **sys-erp**: 5 A5 touchpoints
- **sys-control-tower**: 4 A5 touchpoints
- **sys-event-platform**: 4 A5 touchpoints
- **sys-rate-engine**: 4 A5 touchpoints
- **sys-visibility**: 4 A5 touchpoints
- **sys-case**: 3 A5 touchpoints
- **sys-mobile-delivery**: 3 A5 touchpoints
- **sys-workflow**: 3 A5 touchpoints
- **sys-ap**: 2 A5 touchpoints
- **sys-ar**: 2 A5 touchpoints
- **sys-fleet**: 2 A5 touchpoints

## Controls
- 22 of 22 A5 tasks carry an explicit control record.

## Sources
- 29 source registry records.
- 26 sources are explicitly mapped to one or more A5 tasks.
- Unmapped at A5 in the current child model: src-fmcsa-roles, src-iso14083, src-uncefact-ecmr-brs.

### Source boundary
The Source lens retains each source record’s `supports` and `notSupports` statements. A source appearing in the registry is not treated as support for an A5 task unless that task explicitly declares the source ID.