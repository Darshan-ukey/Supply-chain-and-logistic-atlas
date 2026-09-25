# Competitive Comparison

This page compares `brisk-aitesting` with five AI-led testing products that buyers already recognize:

<table>
  <tr>
    <td align="center"><strong>mabl</strong></td>
    <td align="center"><strong>Katalon</strong></td>
    <td align="center"><strong>Tricentis Tosca</strong></td>
    <td align="center"><strong>testRigor</strong></td>
    <td align="center"><strong>Functionize</strong></td>
  </tr>
</table>

The comparison is split into three views:

<table>
  <tr>
    <td><strong>&#128188; Market strength</strong><br />Since, customer base, and revenue signal.</td>
    <td><strong>&#9881; Product capability</strong><br />What each product publicly appears to support.</td>
    <td><strong>&#128202; Benchmark readiness</strong><br />How each product maps to the mandatory benchmark scenarios.</td>
  </tr>
</table>

Private-company revenue is not audited public revenue. Where the company does not disclose revenue, this page uses cited third-party estimates and labels them as estimates.

Brisk checkmarks represent capabilities present in the current codebase. They are not performance or reliability scores until executed in a shared benchmark lab.

## Market Snapshot

<table>
  <tr>
    <th>Product</th>
    <th>Since</th>
    <th>Customer base</th>
    <th>Revenue</th>
    <th>Positioning</th>
  </tr>
  <tr>
    <td><strong>Brisk</strong></td>
    <td>New open-source product</td>
    <td>Early-stage public package</td>
    <td>Not revenue-generating yet</td>
    <td>Local, embeddable AI testing control layer for UI, API, OpenAPI, execution, and evidence handover.</td>
  </tr>
  <tr>
    <td><strong>mabl</strong></td>
    <td>Founded 2017</td>
    <td>Public customer stories across SaaS, retail, travel, media, and enterprise software</td>
    <td>Estimated annual revenue: about <strong>$34.5M</strong> according to Growjo</td>
    <td>AI-native low-code test automation, self-healing, coverage intelligence, UI and API testing.</td>
  </tr>
  <tr>
    <td><strong>Katalon</strong></td>
    <td>Founded 2016</td>
    <td>Katalon says it serves more than <strong>30,000 teams</strong> globally</td>
    <td>Estimated annual revenue: about <strong>$62.2M</strong> according to Growjo</td>
    <td>Broad quality platform for web, API, mobile, desktop, AI-assisted testing, test management, and integrations.</td>
  </tr>
  <tr>
    <td><strong>Tricentis Tosca</strong></td>
    <td>Tricentis founded 2007</td>
    <td>Tricentis says it has more than <strong>3,000 customers</strong></td>
    <td>Tricentis reported ARR above <strong>$400M</strong> for 2024 and later announced ARR above <strong>$500M</strong></td>
    <td>Enterprise model-based automation, SAP testing, risk-based testing, governance, and large-suite execution.</td>
  </tr>
  <tr>
    <td><strong>testRigor</strong></td>
    <td>Founded 2015</td>
    <td>Public customer stories include enterprise and digital product teams</td>
    <td>Estimated ARR: about <strong>$15M</strong> according to GetLatka</td>
    <td>Plain-English test automation for web, mobile, API, files, email, SMS, and end-to-end flows.</td>
  </tr>
  <tr>
    <td><strong>Functionize</strong></td>
    <td>Founded 2014</td>
    <td>Public positioning targets enterprise and large digital teams</td>
    <td>Estimated annual revenue: about <strong>$38.6M</strong> according to Growjo</td>
    <td>AI testing agents for authoring, execution, diagnosis, maintenance, API checks, data checks, and documentation.</td>
  </tr>
</table>

## Legend

| Icon | Meaning |
|:----:|:--------|
| &#9989; | Native or clearly public capability |
| &#128295; | Extensible, adjacent, or possible with integrations/custom setup |
| &#10060; | Unsupported or not found as a clear public capability |
| &#9899; | Not yet independently benchmarked in a shared public lab |

Score highlights:

<table>
  <tr>
    <td align="center" bgcolor="#dcfce7"><strong>8-10</strong></td>
    <td>Strong</td>
  </tr>
  <tr>
    <td align="center" bgcolor="#fef3c7"><strong>6-7</strong></td>
    <td>Competitive but limited</td>
  </tr>
  <tr>
    <td align="center" bgcolor="#fee2e2"><strong>0-5</strong></td>
    <td>Weak or unclear</td>
  </tr>
</table>

## Product Capability Map

This is a public-evidence map. It does not claim private product internals.

<table>
  <tr>
    <th>Capability</th>
    <th>Brisk</th>
    <th>mabl</th>
    <th>Katalon</th>
    <th>Tosca</th>
    <th>testRigor</th>
    <th>Functionize</th>
  </tr>
  <tr>
    <td><strong>Plain-language test intent</strong><br />Describe what to test without hand-coding every step.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td><strong>UI testing</strong><br />Browser workflows, element actions, screenshots, traces, dynamic pages.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td><strong>API testing</strong><br />HTTP requests, headers, bodies, response checks, and status validation.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td><strong>OpenAPI parsing and runtime schema validation</strong><br />Parse API specs and validate runtime responses against declared schemas.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td><strong>Implementation-contract drift detection</strong><br />Identify implemented-but-undocumented and documented-but-missing routes.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td><strong>Repo and route discovery</strong><br />Inspect supported source patterns and implemented route candidates before planning tests.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
  </tr>
  <tr>
    <td><strong>Validated AI plan before execution</strong><br />AI output must pass a schema and safety gate before anything runs.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
  </tr>
  <tr>
    <td><strong>Multi-engine orchestration</strong><br />One run can route UI, API, contract, and adapter scenarios to the right engine.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td><strong>Embeddable SDK and host-owned UI</strong><br />Another product can own the UI, DB, permissions, reporting, and storage.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td><strong>Stable result handover contract</strong><br />Versioned JSON evidence another product can store, render, compare, or send to CI.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td><strong>Local-first operation</strong><br />Run as SDK/CLI without forcing a proprietary hosted dashboard.</td>
    <td align="center">&#9989;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
  </tr>
  <tr>
    <td><strong>Comparative product capability score</strong><br />Selected public capability score, not full product-completeness or lab benchmark result.</td>
    <td align="center" bgcolor="#dcfce7"><strong>8.6 / 10</strong></td>
    <td align="center" bgcolor="#fef3c7"><strong>6.8 / 10</strong></td>
    <td align="center" bgcolor="#dcfce7"><strong>8.2 / 10</strong></td>
    <td align="center" bgcolor="#fef3c7"><strong>7.6 / 10</strong></td>
    <td align="center" bgcolor="#fef3c7"><strong>6.8 / 10</strong></td>
    <td align="center" bgcolor="#dcfce7"><strong>8.0 / 10</strong></td>
  </tr>
</table>

Notes:

- Brisk contract drift detection is native for OpenAPI operations compared with repo/runtime API routes discovered from supported JavaScript/TypeScript patterns. Current source discovery covers direct Express-style routes, nested router prefixes, `router.route(...).get(...)` chains, Nest-style decorators, and common `:id` versus `{id}` parameter route shapes. It may still miss complex dynamic routes, generated routes, and non-JS/TS backend source patterns.
- Katalon has native OpenAPI/schema validation capabilities, but its own documentation currently notes a validation limitation in `WS.validateOpenApiAgainstSpecification`.
- Functionize has public API Explorer/API testing documentation, but direct public evidence for native OpenAPI scenario generation and implementation-contract drift detection was not found.
- Scores are comparative editorial scores from public capability evidence and Brisk's current implementation. They are not vendor-certified results.

## Mandatory Benchmark Scenario Map

This is the benchmark coverage table that matters. It separates likely/public capability from proven benchmark execution.

For competitors, the icons are based on public product capabilities. They are not lab scores. A real score requires running every product against the same repository, app, API spec, test goals, evaluator, and time limit.

<table>
  <tr>
    <th>#</th>
    <th>Mandatory benchmark scenario</th>
    <th>Brisk</th>
    <th>mabl</th>
    <th>Katalon</th>
    <th>Tosca</th>
    <th>testRigor</th>
    <th>Functionize</th>
  </tr>
  <tr>
    <td>1</td>
    <td>Discover an undocumented frontend application</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td>2</td>
    <td>Discover backend routes from source</td>
    <td align="center">&#9989;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
    <td align="center">&#10060;</td>
  </tr>
  <tr>
    <td>3</td>
    <td>Parse an OpenAPI contract</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td>4</td>
    <td>Identify mismatch between implementation and contract</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td>5</td>
    <td>Generate positive and negative API scenarios</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td>6</td>
    <td>Execute a multi-step authenticated UI workflow</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td>7</td>
    <td>Validate an exact calculated business value</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td>8</td>
    <td>Validate a rejected action and unchanged state</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td>9</td>
    <td>Handle a changed UI selector</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td>10</td>
    <td>Reject malformed, unsupported, or policy-violating AI plans</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
    <td align="center">&#9899;</td>
  </tr>
  <tr>
    <td>11</td>
    <td>Run UI, API, and contract tests in one execution</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
  </tr>
  <tr>
    <td>12</td>
    <td>Produce machine-readable evidence suitable for CI</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#9989;</td>
    <td align="center">&#128295;</td>
    <td align="center">&#128295;</td>
  </tr>
  <tr>
    <td colspan="2"><strong>Comparative benchmark-readiness score</strong><br />Coverage against mandatory scenarios; competitor cells are public-capability mapping, not lab results.</td>
    <td align="center" bgcolor="#dcfce7"><strong>8.6 / 10</strong></td>
    <td align="center" bgcolor="#fef3c7"><strong>6.7 / 10</strong></td>
    <td align="center" bgcolor="#dcfce7"><strong>8.3 / 10</strong></td>
    <td align="center" bgcolor="#dcfce7"><strong>8.3 / 10</strong></td>
    <td align="center" bgcolor="#fef3c7"><strong>6.8 / 10</strong></td>
    <td align="center" bgcolor="#fef3c7"><strong>7.1 / 10</strong></td>
  </tr>
</table>

## Brisk's Position

The established products are strong. They have customers, support teams, integrations, market history, and commercial trust.

Brisk is designed for a different job.

<table>
  <tr>
    <td width="33%"><strong>&#127919; Embeddable by design</strong><br />Brisk can sit inside a SaaS product, internal platform, developer portal, or CI pipeline.</td>
    <td width="33%"><strong>&#128737; AI with control</strong><br />AI proposes the plan. Brisk validates, normalizes, routes, and executes through engines.</td>
    <td width="33%"><strong>&#128230; One evidence shape</strong><br />UI, API, OpenAPI, Schemathesis, Specmatic, Pact, artifacts, assertions, diagnostics, and final results return through a stable contract.</td>
  </tr>
</table>

In simple terms:

> Most testing products sell you a testing platform. Brisk gives you a testing engine you can embed into your own platform.

## Benchmark Method

A fair benchmark should use the same:

| Shared benchmark input | Reason |
|:-----------------------|:-------|
| Application and repository | Avoid vendor-selected demo apps |
| Business scenarios | Compare the same user goals |
| API specification | Compare contract handling equally |
| Environment and time limit | Compare speed, setup effort, and failures fairly |
| Evaluator and pass/fail rules | Score from evidence, not opinion |

Recommended scoring should publish two scores:

| Score | Meaning |
|:------|:--------|
| Product capability score | How well the tool discovers, plans, executes, validates, and reports tests |
| Adoption confidence score | How safe and practical it is for a company to buy, deploy, support, and trust |

## Brisk Local Benchmark

Brisk includes a local benchmark command:

```bash
npm run benchmark
```

Current benchmark coverage is 57 cases across config safety, OpenAPI parsing, schema generation, discovery warnings, implementation-contract drift detection, AI response handling, plan validation, API execution, replay, network policy, and CLI behavior.

This is Brisk's internal proof line. A full public benchmark should add repeated UI flakiness runs, exact business-value checks, state-unchanged checks, changed-selector checks, and cross-vendor execution on the same benchmark app.

## Sources

Product and capability sources:

- mabl: https://www.mabl.com/
- mabl customer stories: https://www.mabl.com/customer-stories
- Katalon: https://katalon.com/
- Katalon about/customer base: https://katalon.com/about-us
- Katalon OpenAPI import: https://docs.katalon.com/katalon-studio/test-objects/api-test-objects/import-web-service-objects/import-rest-request-from-openapi
- Katalon OpenAPI validation limitation: https://docs.katalon.com/katalon-studio/keywords/keyword-description-in-katalon-studio/web-service-keywords/ws-validate-openapi-against-specification
- Tricentis Tosca: https://www.tricentis.com/products/automate-continuous-testing-tosca
- testRigor: https://testrigor.com/
- testRigor API testing: https://testrigor.com/how-to-articles/how-to-do-api-testing-using-testrigor/
- Functionize: https://www.functionize.com/
- Functionize FAQ: https://www.functionize.com/faq
- Functionize API Explorer: https://support.functionize.com/hc/en-us/articles/33001094588567-Using-the-API-Explorer

Revenue and company sources:

- mabl revenue estimate: https://growjo.com/company/mabl
- Katalon revenue estimate: https://growjo.com/company/Katalon
- Tricentis 2024 ARR disclosure: https://www.tricentis.com/news/tricentis-sustains-impressive-2024-growth
- Tricentis $500M ARR announcement: https://www.tricentis.com/news/tricentis-names-kevin-thompson-ceo
- testRigor revenue estimate: https://getlatka.com/companies/testrigor
- Functionize revenue estimate: https://growjo.com/company/Functionize
