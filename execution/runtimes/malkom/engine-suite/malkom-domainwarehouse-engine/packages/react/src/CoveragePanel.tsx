import React from 'react';
import { score } from '@malkom/domainwarehouse-core';
export function CoveragePanel({reference,actual}:{reference:unknown;actual:unknown}){const r=score(reference,actual);return <section><h3>Reference vs Client Actual</h3><strong>{r.score}% aligned</strong><p>{r.matched}/{r.total} reference leaves match exactly.</p><ul>{r.findings.slice(0,20).map((f,i)=><li key={i}>{f.classification} · {f.path}</li>)}</ul></section>}
