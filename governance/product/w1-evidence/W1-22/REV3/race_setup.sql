\set ON_ERROR_STOP on
\i base_subset_W1-21_REV2.sql
\i :iface
insert into atlas_stg_v73.stg_release values ('Universe V7.3','FROZEN_CANONICAL_FOUNDATION','2026-08-30',repeat('a',64),'e5f5029','FROZEN_RELEASE_MANIFEST.json','x','stale',default,default);
insert into atlas_stg_v73.stg_import_run values ('RUN1','Universe V7.3',repeat('b',64),'STAGE','STARTED','{}',null,'FIXTURE',default,null);
insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values ('obj-a','object','SEED'),('obj-b','object','SEED'),('obj-c','object','SEED');
insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,run_id) values ('obj-a','object','A','RUN1'),('obj-b','object','B','RUN1'),('obj-c','object','C','RUN1');
