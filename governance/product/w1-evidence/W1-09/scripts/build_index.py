#!/usr/bin/env python3
"""W1-09: build a local, grep-able term index from the cloned public vocabulary repos (read-only).
Sources indexed (all public issuer repositories):
  one-record  IATA-Cargo/ONE-Record 2026-07-standard Data-Model (DM ontology v3.3 + code-list ontology)
  gs1-cbv     gs1/EPCIS Ontology/CBV.ttl      (GS1 Core Business Vocabulary, RDF form)
  gs1-epcis   gs1/EPCIS Ontology/EPCIS.ttl    (GS1 EPCIS, RDF form)
  uncefact    uncefact/spec-JSONSchema library/BuyShipPay/D23B (UN/CEFACT BSP / CBM / MMT / SCRDM schemas, JSON Schema form)
usage: build_index.py <vocab_dir> <out.jsonl>
"""
import sys, re, json, os, glob

vocab, out = sys.argv[1], sys.argv[2]
rows = []

def add(src, kind, name, label, comment, loc):
    rows.append({"src": src, "kind": kind, "name": name, "label": (label or "")[:300], "comment": (comment or "")[:600], "loc": loc})

# ---------- turtle (regex, no rdflib): split into subject blocks ----------
def parse_ttl(path, src, relloc):
    txt = open(path, encoding="utf-8", errors="replace").read()
    # drop prefixes
    # entity blocks are separated either by blank lines or by "###  <IRI>" comment lines (ONE Record style)
    txt = re.sub(r"^#[^\n]*$", "", txt, flags=re.M)   # drop whole-line turtle comments (### IRI separators)
    blocks = re.split(r"\n\s*\n", txt)
    for b in blocks:
        m = re.match(r"\s*(<[^>]+>|[A-Za-z0-9_\-]*:[A-Za-z0-9_\-\.%]*)\s+(.*)", b, re.S)
        if not m:
            continue
        subj = m.group(1)
        body = m.group(2)
        types = re.findall(r"(?:rdf:type|\ba\b)\s+([^;\.\n]+)", body)
        kind = ",".join(t.strip() for t in types)[:80] if types else ""
        lab = re.search(r"rdfs:label\s+\"((?:[^\"\\]|\\.)*)\"", body)
        com = re.search(r"(?:rdfs:comment|skos:definition|dc:description)\s+\"((?:[^\"\\]|\\.)*)\"", body)
        name = subj.split("#")[-1].split("/")[-1].strip("<>") if subj.startswith("<") else subj.split(":", 1)[1]
        add(src, kind, name, lab.group(1) if lab else "", com.group(1) if com else "", relloc)

onerec = os.path.join(vocab, "ONE-Record/2026-07-standard/Data-Model")
parse_ttl(os.path.join(onerec, "IATA-1R-DM-Ontology.ttl"), "one-record", "ONE-Record/2026-07-standard/Data-Model/IATA-1R-DM-Ontology.ttl")
parse_ttl(os.path.join(onerec, "IATA-1R-CL-Ontology.ttl"), "one-record-cl", "ONE-Record/2026-07-standard/Data-Model/IATA-1R-CL-Ontology.ttl")
parse_ttl(os.path.join(vocab, "EPCIS/Ontology/CBV.ttl"), "gs1-cbv", "EPCIS/Ontology/CBV.ttl")
parse_ttl(os.path.join(vocab, "EPCIS/Ontology/EPCIS.ttl"), "gs1-epcis", "EPCIS/Ontology/EPCIS.ttl")

# ---------- UN/CEFACT JSON schema (D23B library) ----------
base = os.path.join(vocab, "spec-JSONSchema/JSONschema2020-12/library/BuyShipPay/D23B")
for f in sorted(glob.glob(os.path.join(base, "*.json"))):
    try:
        j = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        continue
    fn = os.path.basename(f)
    defs = j.get("$defs") or j.get("definitions") or {}
    add("uncefact", "schema-file", fn, j.get("title", ""), j.get("description", ""), "spec-JSONSchema/JSONschema2020-12/library/BuyShipPay/D23B/" + fn)
    for k, v in defs.items():
        if isinstance(v, dict):
            add("uncefact", "def", k, v.get("title", ""), v.get("description", ""), "spec-JSONSchema/JSONschema2020-12/library/BuyShipPay/D23B/" + fn + "#/$defs/" + k)
            props = v.get("properties") or {}
            for pk, pv in props.items():
                if isinstance(pv, dict):
                    add("uncefact", "prop", k + "." + pk, pv.get("title", ""), pv.get("description", ""), "spec-JSONSchema/JSONschema2020-12/library/BuyShipPay/D23B/" + fn + "#/$defs/" + k)

with open(out, "w") as o:
    for r in rows:
        o.write(json.dumps(r) + "\n")
from collections import Counter
print(Counter(r["src"] for r in rows))
