#!/bin/bash
# usage: race2.sh <iface> <isolation> <db> <A.sql> <B.sql> <extra setup or ->
P="psql -h /tmp -p 5544 -q"; db=$3
dropdb -h /tmp -p 5544 --if-exists $db 2>/dev/null; createdb -h /tmp -p 5544 $db
$P -d $db -v iface=$1 -f race_setup.sql >/dev/null 2>&1
[ "$6" != "-" ] && $P -d $db -f $6 >/dev/null 2>&1
$P -d $db -v iso="$2" -f $4 > a_$db.out 2>&1 &
sleep 1
$P -d $db -v iso="$2" -f $5 > b_$db.out 2>&1
wait
echo "[$1 | $2 | $4 vs $5]"
echo -n "  B result: "; grep -E "ERROR|COMMIT|INSERT" b_$db.out | head -1 | cut -c1-150; grep -q ERROR b_$db.out || echo "(B committed without error)"
echo -n "  rows committed: "; psql -h /tmp -p 5544 -d $db -Atc "select string_agg(construct_id||':'||alias_raw||':'||alias_state, ', ' order by construct_id) from atlas_stg_v73.stg_alias"
