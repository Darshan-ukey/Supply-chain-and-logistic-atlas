begin;
set transaction isolation level :iso;
insert into atlas_stg_v73.stg_alias(alias_norm,construct_kind,construct_id,alias_raw,alias_state) values ('shipment-record','object','obj-b','shipment-record','PROPOSED');
commit;
