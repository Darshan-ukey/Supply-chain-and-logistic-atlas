-- W1-21 DESIGN ONLY. NOT EXECUTED. Read-only functions/queries for staging tests and impact analysis.

-- Q-IMPACT: high-risk dependency traversal (DEC-058 d). Start from a source (via routes) or a construct;
-- follows stg_edge in both directions, cycle-guarded, depth-limited, criticality-filtered.
create function atlas_stg_v73.stg_impact(p_start_id text, p_start_kind text, p_max_depth int default 6,
                                         p_min_criticality text default 'HIGH')
returns table (depth int, via_edge text, node_id text, node_kind text, criticality text, path text[])
language sql stable as $$
  with recursive rank(c, r) as (values ('LOW',1),('MEDIUM',2),('HIGH',3),('CRITICAL',4)),
  walk as (
    select 0 as depth, null::text as via_edge, p_start_id as node_id, p_start_kind as node_kind,
           null::text as criticality, array[p_start_kind || ':' || p_start_id] as path
    union all
    select w.depth + 1, e.edge_id,
           case when e.from_id = w.node_id and e.from_kind = w.node_kind then e.to_id else e.from_id end,
           case when e.from_id = w.node_id and e.from_kind = w.node_kind then e.to_kind else e.from_kind end,
           e.criticality,
           w.path || (case when e.from_id = w.node_id and e.from_kind = w.node_kind then e.to_kind || ':' || e.to_id
                           else e.from_kind || ':' || e.from_id end)
    from walk w
    join atlas_stg_v73.stg_edge e
      on (e.from_id = w.node_id and e.from_kind = w.node_kind) or (e.to_id = w.node_id and e.to_kind = w.node_kind)
    where w.depth < p_max_depth
      and coalesce((select r from rank where c = e.criticality), 0) >= (select r from rank where c = p_min_criticality)
      and not ((case when e.from_id = w.node_id and e.from_kind = w.node_kind then e.to_kind || ':' || e.to_id
                     else e.from_kind || ':' || e.from_id end) = any (w.path))
  )
  select * from walk where depth > 0;
$$;

-- Q-ROUTE: sources with no route (must be 0 unrouted after IC-4, or each listed with Owner-assigned route basis)
create view atlas_stg_v73.v_unrouted_sources as
select s.source_id from atlas_stg_v73.stg_source s
where s.admission_state = 'SEED_GOVERNED'
  and not exists (select 1 from atlas_stg_v73.stg_source_route r
                  where r.source_id = s.source_id and r.target_kind in ('domain','lens','cycle')
                    and r.route_basis <> 'ASSESSOR_PROPOSED_UNCONFIRMED');

-- Q-PROFILE-DELTA: deltas against seed (expect exactly 11 = PC-01..PC-11 and 65 additions)
create view atlas_stg_v73.v_profile_delta as
select mode_id, dimension, item_id, seed_status, status, change_ref
from atlas_stg_v73.stg_profile where seed_status is distinct from status;

-- Q-PROFILE-COUNTS
create view atlas_stg_v73.v_profile_counts as
select status, count(*) from atlas_stg_v73.stg_profile group by status;

-- Q-DOMAIN-READINESS: derived (labelled) per-domain readiness from linked lens states (G-067)
create view atlas_stg_v73.v_domain_readiness as
select d.construct_id as domain_id, l.readiness_state, count(*) as lens_count, 'DERIVED'::text as label
from atlas_stg_v73.stg_construct d
join atlas_stg_v73.stg_construct l on l.construct_kind = 'lens' and d.construct_id = any (l.domain_ids)
where d.construct_kind = 'domain' group by 1, 2;

-- Q-UNROUTED-ENTITIES: non-relationship entities with no domain / no source route (flagged, never guessed) (G-052, G-061)
create view atlas_stg_v73.v_unrouted_entities as
select c.construct_id, c.construct_kind,
       (cardinality(c.domain_ids) = 0) as no_domain,
       not exists (select 1 from atlas_stg_v73.v_source_entity_scope v
                   where v.construct_id = c.construct_id and v.construct_kind = c.construct_kind) as no_source_route
from atlas_stg_v73.stg_construct c
where c.construct_kind in ('system','object','actor','event','document')
  and (cardinality(c.domain_ids) = 0 or not exists (select 1 from atlas_stg_v73.v_source_entity_scope v
                   where v.construct_id = c.construct_id and v.construct_kind = c.construct_kind));
