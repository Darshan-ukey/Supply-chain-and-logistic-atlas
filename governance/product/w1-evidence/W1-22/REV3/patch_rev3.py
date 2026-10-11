import sys
src=open('normalization_interface_REV2_DESIGN_ONLY.sql').read()
def rep(a,b,cnt=1):
    global src
    assert src.count(a)==cnt,(a,src.count(a)); src=src.replace(a,b)
rep("-- W1-22 REV2 normalization interface","-- W1-22 REV3 (rework round 3 after W1-23 QA R2 FAIL F4: concurrent strict alias-key collision) = REV2 + the changes marked REV3.\n-- W1-22 REV2 normalization interface")
rep("-- 0. one additive change_class","-- REV3: btree_gist gives the exclusion constraints below ('different construct' operator). On Supabase: create extension if not exists btree_gist with schema extensions (W1-25 to confirm).\ncreate extension if not exists btree_gist;\n\n-- 0. one additive change_class")
rep("  add column alias_key   text,\n","  add column alias_key   text generated always as (atlas_stg_v73.stg_strict_key(alias_raw)) stored,   -- REV3: generated, so the database owns the key\n")
rep("declare amb atlas_stg_v73.stg_ambiguity%rowtype; cr atlas_stg_v73.stg_change_request%rowtype; mykey text;","declare amb atlas_stg_v73.stg_ambiguity%rowtype; cr atlas_stg_v73.stg_change_request%rowtype; mykey text; v_key text;")
rep("  new.alias_key := atlas_stg_v73.stg_strict_key(new.alias_raw);","  v_key := atlas_stg_v73.stg_strict_key(new.alias_raw);   -- REV3: generated columns are not yet set in a BEFORE trigger")
src=src.replace("new.alias_key","v_key")
rep("create function atlas_stg_v73.stg_alias_guard()","""-- REV3 (F4 R2): the strict-key exclusivity is now ENFORCED BY THE DATABASE, not only by the trigger's SELECT, which cannot see an
-- uncommitted concurrent insert.  Exclusion constraints check in-flight rows of other transactions (the second writer waits, then fails)
-- and behave the same under READ COMMITTED, REPEATABLE READ and SERIALIZABLE.
alter table atlas_stg_v73.stg_alias add column alias_class smallint generated always as (case alias_state when 'AMBIGUOUS' then 2 when 'RETIRED' then null else 1 end) stored;\n--  (1) two different constructs of one kind may not both hold a live alias with the same strict key
alter table atlas_stg_v73.stg_alias add constraint stg_alias_one_live_owner_per_key
  exclude using gist (construct_kind with =, alias_key with =, construct_id with <>) where (alias_class = 1);
--  (2) a live owner and an AMBIGUOUS holder of a different construct may not coexist for one strict key
--      (AMBIGUOUS+AMBIGUOUS is allowed: that is the register case); RETIRED rows (alias_class null) are outside both constraints
alter table atlas_stg_v73.stg_alias add constraint stg_alias_no_live_beside_ambiguous
  exclude using gist (construct_kind with =, alias_key with =, construct_id with <>, alias_class with <>) where (alias_class is not null);

create function atlas_stg_v73.stg_alias_guard()""")
open('normalization_interface_REV3_DESIGN_ONLY.sql','w').write(src)
