<div align="center">
  <img src="./assets/logo_transparent.png" alt="brisk-aitesting logo" width="160" />
  <h1>brisk-aitesting</h1>
  <p><strong>Fast, No-nonsense and Effective</strong></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
    <img src="https://img.shields.io/badge/status-alpha-orange" alt="Status: Alpha" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
    <img src="https://img.shields.io/badge/local-first-yes-8A2BE2" alt="Local First" />
    <img src="https://img.shields.io/badge/engines-UI_|_API_|_Contract_|_Schema_|_Replay_|_Message-blue" alt="Built-in engines" />
  </p>
</div>

<br />

<!-- Hero -->
<div align="center">
  <h2>A locally embeddable software testing layer, powered by AI planning and precise engineering.</h2>
  <p>
    Embed it inside your product, run it from the CLI, or wire it into CI.
    Tell it what to test in human language. Brisk discovers the app, plans the checks, runs the right engines, and returns clean evidence.
    No hosted meter. No forced dashboard. Your software owns the workflow and the result.
  </p>
</div>

<br />

`brisk-aitesting` helps teams turn a human testing goal into real, runnable checks for SaaS products, APIs, UI flows, OpenAPI contracts, and custom systems.

It is built for two audiences at once:

| Audience | Why they should care |
|:---------|:---------------------|
| Business leaders | Software is being created faster than manual verification can keep up. Testing is expensive, fragmented, and full of repeated work. |
| Developers | Use a local SDK and CLI that can inspect your app, produce a safe test plan, run browser/API/contract checks, and hand back one result object. |

<!-- The Promise Card -->
<table>
  <tr>
    <td align="center">
      <h3>The Promise</h3>
      <blockquote>
        <em>Say what should be tested.<br />
        Brisk discovers what exists.<br />
        It chooses the right test path.<br />
        It creates a checked plan.<br />
        It runs the right engines.<br />
        It returns evidence your product can use.</em>
      </blockquote>
      <br />
      <sub>This is <strong>not</strong> just a Playwright wrapper. Playwright is one built-in engine. API checks, OpenAPI contract checks, schema validation, route discovery, AI planning, validation, repair, evidence capture, and result handover are also part of the product.</sub>
    </td>
  </tr>
</table>

## Why This Exists

Software testing is now a **global problem**.

AI is accelerating how fast software gets created. Industry leaders are clear:

<br />

<!-- Executive Quotes -->
<table>
  <tr>
    <td width="33%" align="center">
      <blockquote>AI could write <strong>90% of code</strong> in a short time window and eventually nearly all code.</blockquote>
      <sub>— <strong>Dario Amodei</strong>, Anthropic CEO<br />
      <a href="https://www.cfr.org/event/ceo-speaker-series-dario-amodei-anthropic">Council on Foreign Relations</a></sub>
    </td>
    <td width="33%" align="center">
      <blockquote>More than a <strong>quarter of new Google code</strong> was already AI-generated and then reviewed by engineers.</blockquote>
      <sub>— <strong>Sundar Pichai</strong>, Google CEO<br />
      <a href="https://www.theverge.com/2024/10/29/24282757/google-new-code-generated-ai-q3-2024">The Verge</a></sub>
    </td>
    <td width="33%" align="center">
      <blockquote>A <strong>very large share</strong> of code will be AI-generated within five years.</blockquote>
      <sub>— <strong>Kevin Scott</strong>, Microsoft CTO<br />
      <a href="https://www.businessinsider.com/microsoft-cto-ai-generated-code-software-developer-job-change-2025-4">Business Insider</a></sub>
    </td>
  </tr>
</table>

<br />

Yet testing remains **expensive and fragmented**.

<!-- Market Stats -->
<table>
  <tr>
    <td align="center" bgcolor="f0f8ff">
      <h3>💰 $54.44B</h3>
      <sub>Software testing market (2026)</sub>
    </td>
    <td align="center" bgcolor="f0f8ff">
      <h3>📈 $99.94B</h3>
      <sub>Projected by 2031</sub>
    </td>
    <td align="center" bgcolor="fff0f0">
      <h3>💰 $24.25B</h3>
      <sub>Automation testing market (2026)</sub>
    </td>
    <td align="center" bgcolor="fff0f0">
      <h3>📈 $84.22B</h3>
      <sub>Projected by 2034</sub>
    </td>
  </tr>
  <tr>
    <td colspan="4" align="center">
      <sub>
        <a href="https://www.mordorintelligence.com/industry-reports/software-testing-market">Mordor Intelligence</a>
        &nbsp;·&nbsp;
        <a href="https://www.fortunebusinessinsights.com/automation-testing-market-107180">Fortune Business Insights</a>
      </sub>
    </td>
  </tr>
</table>

<br />

> **The world is producing software faster, but verification is still slow, manual, tool-heavy, and expensive.**

<br />

### The Old Workflow

| Step | Who | Pain |
|:----:|:---:|:----:|
| 1 | Product teams | Explain what should be tested |
| 2 | Testers | Translate into manual UAT steps |
| 3 | Automation engineers | Write Playwright, API, contract, or custom scripts |
| 4 | Multiple tools | Produce different reports |
| 5 | Developers | Spend time finding what failed and why |
| 6 | Everyone | Rebuild the same testing pipeline again |

### The brisk-aitesting Solution

| Step | What happens |
|:----:|:------------|
| 1 | Say the goal in **human language** |
| 2 | Let **discovery** inspect the app, repo, routes, and contracts |
| 3 | Let **AI** create a structured JSON plan, not unsafe code |
| 4 | **Validate and repair** the plan before execution |
| 5 | **Ground** UI actions against real page evidence |
| 6 | **Execute** with the right engines |
| 7 | Return **one stable handover object** for CI, dashboards, databases, or internal platforms |

## Competitive Position

The AI testing market is already real. Products like mabl, Katalon, Tricentis Tosca, testRigor, and Functionize prove that serious companies spend heavily to reduce manual testing, flaky automation, and slow release cycles.

Brisk is designed differently: local, embeddable, evidence-first, and built around a strict AI safety boundary.

| Positioning point | Why Brisk is different |
|:------------------|:-----------------------|
| Local by default | Use it inside your own product, CLI, or CI without forcing a hosted dashboard |
| AI with control | AI proposes structured plans; Brisk validates before execution |
| Multi-engine architecture | UI, API, OpenAPI contracts, schema fuzzing, replay, Playwright, Schemathesis, Specmatic, and Pact can share one pipeline. Heavy third-party adapters are opt-in installs. |
| Evidence handover | Results come back as versioned JSON your product can store, render, or send to CI |
| Extensible by design | Custom engines and adapters fit the same result contract |

See the sourced enterprise comparison in the repository: [Competitive Comparison](https://github.com/oshjain/brisk-aitesting/blob/main/docs/COMPETITIVE_COMPARISON.md).

## How It Works

`brisk-aitesting` is not "AI writes random Playwright code and runs it."

It is a controlled testing pipeline:

| Step | What happens |
|:----:|:-------------|
| 1 | It looks at your repo, routes, UI pages, and OpenAPI files. |
| 2 | It asks AI to create a structured test plan in JSON. |
| 3 | It checks and repairs that plan before anything is allowed to run. |
| 4 | It sends each test to the right built-in engine: browser, API, OpenAPI contract, schema fuzz, or replay. |
| 5 | It collects screenshots, traces, request/response data, logs, and final results. |
| 6 | It gives your app one stable JSON result that you can store, show, or send to CI. |

The most important idea is simple:

```text
AI suggests the plan.
Brisk checks the plan.
Engines run the tests.
Evidence shows what actually happened.
```

## Product Status

This section keeps the promise honest: what is built, what is partly built, and what is still expansion work.

| Area | Status today | What users get |
|:-----|:-------------|:---------------|
| UI testing | Built | Browser tests through Playwright with grounded page evidence. |
| API testing | Built | HTTP checks, status checks, body checks, headers, and schema-backed response checks. |
| OpenAPI testing | Built | JSON/YAML contract parsing, route discovery, positive and negative API scenarios, response schema validation. |
| Built-in schema fuzzing | Built | Fast malformed-request checks from OpenAPI request schemas, with evidence in the same result contract. |
| Contract drift report | Built | Compares OpenAPI operations with repo/runtime API routes discovered from supported JavaScript/TypeScript patterns and reports matched, undocumented, and missing routes. |
| AI planning | Built | AI returns JSON plans. Plans pass the public AJV-backed contract gate, then Brisk validates and repairs them before execution. |
| Result handover | Built | One versioned JSON result for CI, dashboards, databases, and internal tools. |
| Local SDK/CLI | Built | Use it inside your app or from the command line. No hosted platform required. |
| Schemathesis OpenAPI deep API checker | Built | Optional Python/Schemathesis engine that sends many real OpenAPI request variations. |
| Replay engine | Built | Reruns declared HTTP interactions to catch regressions quickly, with evidence in the same result contract. |
| Message/event testing | Built | AsyncAPI message-contract inspection, local live publish/verify flows, and Pact message verification are available. |
| Specmatic adapter | Built | Optional Specmatic CLI engine for provider contract testing and mock/service-virtualization flows, with Brisk evidence output. Requires Java plus the `specmatic` package/runtime. |
| UI healing | Built | If a grounded UI action has stale evidence but clear intent, Brisk captures fresh page evidence, retries once, and records what changed. |
| Serious SaaS proof app | Built | A real sample product used to prove auth, roles, UI, API, OpenAPI, negative cases, state changes, and saved evidence. |
| Proof app collection | Built | Serious SaaS, API-only, Todo, multi-tenant, e-commerce, and event/messaging proof apps run today. |
| Built-in engine quality check | Built | Built-in engines must prove they can run, return the expected result shape, and save evidence. |
| External engine quality check | Built for engines | Third-party engines must prove routing, result shape, artifact shape, timeout handling, and secret safety before being trusted. |
| Non-engine extension checks | Built | Discoverer, planner, validator, UI grounder, and AI provider extensions have a conformance gate. |
| Release automation | Built | `release:check` verifies typecheck, build, CI smoke, benchmark, package safety, and changelog readiness. |

### What Is Ready Now

These are not future promises anymore:

| Ready now | Why it matters |
|:----------|:---------------|
| Serious SaaS proof app | We test against a real product shape, not only tiny examples. |
| Golden expected outputs | We keep known-good plans and results so future changes cannot quietly weaken behavior. |
| Public plan contract gate | Every plan must pass the exported `brisk-aitesting.plan.v1` JSON Schema before Brisk-specific execution checks run. |
| External engine quality check | A custom engine must prove it behaves safely before teams trust it. |
| Schemathesis OpenAPI deep API checker | Brisk can run a real third-party OpenAPI testing tool and fold the results into the same evidence format. |
| Specmatic contract adapter | Brisk can run Specmatic provider contract checks and collect the result as `brisk-aitesting.specmatic-evidence.v1`. |
| Built-in schema fuzzing | Brisk can run fast malformed-request checks from OpenAPI request schemas without Python. |
| Built-in replay engine | Brisk can rerun declared HTTP interactions and show exactly what changed. |
| Adapter readiness gate | If we call an adapter "built", automation checks code, docs, packaging, CI wiring, proof app coverage, and result evidence. |
| Non-engine extension conformance | Custom discoverers, planners, validators, UI grounders, and AI providers can be checked before teams trust them. |
| Rejected-action state proof | API scenarios can capture before/after snapshots and prove a rejected action did not change state. |
| UI healing evidence | UI runs produce `brisk-aitesting.ui-healing.v1` evidence showing replacement attempts. |
| Release readiness check | Releases have a repeatable command and matching changelog check. |

### Still To Build

These are the real remaining product areas, listed separately so nobody confuses them with completed work:

| Still to build | User impact |
|:----------------|:------------|
| More golden outputs | More stable expected-result baselines across app shapes. |
| Message depth | More broker-specific adapters for systems such as Kafka, RabbitMQ, or cloud queues. |
| Adapter depth | More behavior checks for Specmatic mock/service-virtualization across larger proof apps. |

## What It Solves

`brisk-aitesting` helps teams avoid the biggest testing bottlenecks:

<!-- Bottleneck Cards -->
<table>
  <tr>
    <td>❌ <strong>No need</strong> to hand-code every test from scratch</td>
    <td>❌ <strong>No need</strong> to force every scenario into only browser automation</td>
  </tr>
  <tr>
    <td>❌ <strong>No need</strong> to trust raw AI-generated TypeScript</td>
    <td>❌ <strong>No need</strong> to build a database or dashboard into the engine</td>
  </tr>
  <tr>
    <td>❌ <strong>No need</strong> to throw away existing host-app configuration</td>
    <td>❌ <strong>No need</strong> to guess selectors from AI output</td>
  </tr>
</table>

<br />

### Designed For

<table>
  <tr>
    <td align="center">🏢</td>
    <td><strong>SaaS platforms</strong></td>
    <td align="center">🏭</td>
    <td><strong>Internal enterprise apps</strong></td>
  </tr>
  <tr>
    <td align="center">💻</td>
    <td><strong>Local developer repos</strong></td>
    <td align="center">🔌</td>
    <td><strong>API-first products</strong></td>
  </tr>
  <tr>
    <td align="center">📋</td>
    <td><strong>OpenAPI-backed services</strong></td>
    <td align="center">🌐</td>
    <td><strong>Browser workflows</strong></td>
  </tr>
  <tr>
    <td align="center">🔄</td>
    <td><strong>CI pipelines</strong></td>
    <td align="center">⚙️</td>
    <td><strong>Custom test engines</strong></td>
  </tr>
</table>

## 🚀 What It Can Do

`brisk-aitesting` is designed to be the **embedded testing layer** that a product team can plug into its own SaaS, repo, CI, or internal platform.

<br />

<div align="center">
  <blockquote><em>It does not only click screens.<br />It understands app surfaces, plans tests, chooses engines, runs checks, and returns evidence.</em></blockquote>
</div>

<br />

### 🔍 Discovery & Inspection

<table>
  <tr>
    <td>📂</td>
    <td>Inspect the repository itself</td>
    <td>🔧</td>
    <td>Identify backend frameworks and application structure</td>
  </tr>
  <tr>
    <td>🛣️</td>
    <td>Discover backend routes from supported JavaScript/TypeScript source patterns</td>
    <td>🌐</td>
    <td>Discover UI routes separately</td>
  </tr>
  <tr>
    <td>📄</td>
    <td>Locate OpenAPI contract files in JSON or YAML</td>
    <td>🔗</td>
    <td>Correlate contracts with implemented routes</td>
  </tr>
  <tr>
    <td>⚠️</td>
    <td>Detect routes that exist in code but are missing from contracts</td>
    <td>🔍</td>
    <td>Detect contract operations without matching implementation signals</td>
  </tr>
</table>

### 🧪 Test Generation & Validation

<table>
  <tr>
    <td>✅</td>
    <td>Generate <strong>positive</strong> API scenarios from OpenAPI request schemas</td>
    <td>❌</td>
    <td>Generate <strong>negative</strong> API scenarios from OpenAPI request schemas</td>
  </tr>
  <tr>
    <td>📊</td>
    <td>Validate runtime API responses against OpenAPI response schemas</td>
    <td>🔢</td>
    <td>Check HTTP status codes, response bodies, headers, and schema expectations</td>
  </tr>
  <tr>
    <td>🔄</td>
    <td>Route built-in scenarios into UI, API, and OpenAPI contract engines</td>
    <td>🎭</td>
    <td>Run browser workflows through Playwright</td>
  </tr>
  <tr>
    <td>🎯</td>
    <td>Ground UI actions in observed page evidence (roles, labels, text, test IDs, stable selectors)</td>
    <td>🛡️</td>
    <td>Prevent unsafe test execution by validating every plan before engines run</td>
  </tr>
  <tr>
    <td>🔧</td>
    <td>Repair invalid structured plans through a validation feedback loop</td>
    <td>🧩</td>
    <td>Accept custom engines for schema fuzzing, replay, messaging, database, mobile, or enterprise-specific systems</td>
  </tr>
  <tr>
    <td>📝</td>
    <td>Turn user-supplied business intent into executable scenarios</td>
    <td>🔍</td>
    <td>Preserve objectives and assertions so business meaning stays visible in the result</td>
  </tr>
  <tr>
    <td>🧾</td>
    <td>Check exact values, ranges, JSON fields, status codes, and schema-backed response shapes</td>
    <td></td>
    <td></td>
  </tr>
</table>

### 🧭 Business Intent as Executable Scenarios

`brisk-aitesting` does not need to automatically know every business rule in a company. The practical model is simpler and stronger:

```text
Brisk discovers the application's testable surfaces.
The user supplies the important business intent.
The planner maps that intent to UI, API, and contract checks.
Engines execute the checks and return evidence.
```

For example, a user can say:

```text
Given a booking date after vessel departure,
when a booking is created,
then the API must reject it with VESSEL_ALREADY_DEPARTED.
```

That is already a business rule expressed as an executable scenario. A formal rule registry can come later, but the first useful unit is simple: context, action, expected outcome, and evidence.

### 📦 Output & Integration

<table>
  <tr>
    <td>📋</td>
    <td>Produce unified, versioned, machine-consumable result JSON</td>
    <td>📎</td>
    <td>Produce evidence artifacts for API calls, browser runs, contracts, logs, traces, screenshots, and generated specs</td>
  </tr>
  <tr>
    <td>💻</td>
    <td>Work as a local <strong>SDK</strong></td>
    <td>⌨️</td>
    <td>Work as a <strong>CLI</strong></td>
  </tr>
  <tr>
    <td>☁️</td>
    <td>Run without a proprietary hosted platform</td>
    <td>🏠</td>
    <td>Let host products own their own database, dashboard, CI, and observability flow</td>
  </tr>
  <tr>
    <td>🔌</td>
    <td>Accept host-app configuration through a bridge instead of forcing duplicate setup</td>
    <td>🤖</td>
    <td>Support provider-agnostic AI configuration through environment variables or custom providers</td>
  </tr>
  <tr>
    <td>🧩</td>
    <td>Support custom engines for systems outside the built-in UI/API/contract scope</td>
    <td></td>
    <td></td>
  </tr>
</table>

## ⏳ What It Cannot Do Yet

`brisk-aitesting` is powerful, but it is not pretending to be every testing product in the world on day one.

<br />

### Current Product Boundaries

<table>
  <tr>
    <td>📊</td>
    <td>It does <strong>not</strong> replace all specialized <strong>performance testing</strong> tools yet</td>
  </tr>
  <tr>
    <td>🔒</td>
    <td>It does <strong>not</strong> replace full <strong>security penetration testing</strong> platforms yet</td>
  </tr>
  <tr>
    <td>📈</td>
    <td>It does <strong>not</strong> provide a hosted <strong>dashboard</strong> yet</td>
  </tr>
  <tr>
    <td>🗄️</td>
    <td>It does <strong>not</strong> provide built-in long-term test <strong>history storage</strong> yet</td>
  </tr>
  <tr>
    <td>📱</td>
    <td>It does <strong>not</strong> run native <strong>mobile</strong> app tests without a custom mobile engine</td>
  </tr>
  <tr>
    <td>🖥️</td>
    <td>It does <strong>not</strong> run <strong>desktop</strong> app tests without a custom desktop engine</td>
  </tr>
  <tr>
    <td>🗃️</td>
    <td>It does <strong>not</strong> deeply validate <strong>databases, queues, streams, or non-HTTP systems</strong> without custom engines</td>
  </tr>
  <tr>
    <td>🧪</td>
    <td>It does <strong>not</strong> automatically create safe test data for every enterprise system yet</td>
  </tr>
  <tr>
    <td>🎯</td>
    <td>It does <strong>not</strong> guarantee good UI grounding for apps with no accessible labels, roles, text, test IDs, or stable selectors</td>
  </tr>
  <tr>
    <td>🌐</td>
    <td>It does <strong>not</strong> bypass network, auth, firewall, VPN, or environment restrictions</td>
  </tr>
  <tr>
    <td>📝</td>
    <td>It does <strong>not</strong> remove the need for product owners to describe high-value workflows and expected business behavior</td>
  </tr>
  <tr>
    <td>🛣️</td>
    <td>It does <strong>not</strong> discover source-code routes for every backend language yet. HTTP execution can test any reachable API, but source inspection is currently strongest for supported JavaScript/TypeScript patterns.</td>
  </tr>
</table>

<br />

### Compared with Single-Purpose Tools

| Tool | What it does | How brisk fits |
|:----:|:------------|:--------------|
| 🎭 **Playwright** | Excellent for browser automation | brisk-aitesting uses it as **one engine** inside a larger testing pipeline |
| 📡 **API Clients** | Excellent for sending requests | brisk-aitesting connects API testing with **discovery, contracts, schemas, and unified results** |
| 📋 **Contract Tools** | Excellent for contract checks | brisk-aitesting connects contracts to **runtime execution and scenario generation** |
| ✅ **Test Management** | Excellent for tracking work | brisk-aitesting focuses on **generating, executing, and handing over evidence** that those systems can consume |

## 🎯 Where It Works Best

`brisk-aitesting` is strongest when the app exposes one or more of these surfaces:

> 🌐 a browser UI reachable through `http://localhost`, staging, or an allowed host
> 🏷️ HTML elements with accessible labels, roles, text, or test IDs
> 🔗 REST APIs reachable over HTTP
> 📜 OpenAPI 3.x contracts in JSON or YAML
> 📁 a local repository that can be inspected for routes, framework signals, and package metadata
> 📦 CI environments where JSON artifacts can be stored or uploaded

<br />

### ✅ Most Compatible Today

| Area | Current fit |
|:----:|:------------|
| 🖥️ **Frontend apps** | React, Next.js, Vite, Angular, Vue, Svelte, static HTML, and most browser-rendered apps that Playwright can open |
| ⚙️ **Backend API execution** | Any backend with reachable HTTP endpoints: Node.js, Python, Java, .NET, Go, Rails, or internal services behind an allowed host |
| 🛣️ **Source route discovery** | JavaScript/TypeScript routes using supported Express-style direct calls, nested routers, `router.route(...).get(...)` chains, Nest-style decorators, and OpenAPI parameter matching |
| 📜 **API contracts** | OpenAPI 3.x JSON/YAML |
| 🎭 **UI testing** | Browser flows through Playwright |
| 📡 **API testing** | HTTP request/response checks, status checks, JSON body checks, OpenAPI response schema validation |
| 🔑 **Auth** | no auth, credentials, bearer token, or host-provided custom auth metadata |
| 🤖 **AI providers** | built-in OpenAI/OpenAI-compatible chat-completions path, plus custom `AiPlannerProvider` adapters |
| 💾 **Storage** | host-owned database, CI artifact store, dashboard, logs, or observability pipeline |

<br />

### 🧩 Works with Custom Engines

<table>
  <tr>
    <td>🗄️ Databases</td>
    <td>📨 Queues and messaging systems</td>
    <td>📊 Event streams</td>
  </tr>
  <tr>
    <td>📱 Mobile apps</td>
    <td>🖥️ Desktop apps</td>
    <td>🔗 Non-HTTP protocols</td>
  </tr>
  <tr>
    <td>🏢 Proprietary enterprise platforms</td>
    <td>🖧 Mainframe or legacy systems</td>
    <td></td>
  </tr>
</table>

<br />

### ⚠️ Not a Good Fit Yet (Without Extension)

| Reason | Detail |
|:-----:|:-------|
| 🌐 | Apps that cannot be reached by the runtime network |
| 🚫 | UIs that block automation completely |
| 🏷️ | Pages with no stable accessible labels, roles, text, test IDs, or usable selectors |
| 📱 | Native mobile apps without a mobile engine |
| 🔢 | Binary protocols without a custom engine |
| 🔐 | Systems where the product owner cannot provide auth, base URL, contracts, or safe test data |

<br />

### Simple Rule

<div align="center">
  <table>
    <tr>
      <td align="center">
        <blockquote>
          <strong>If Playwright can open it, API calls can reach it, or OpenAPI can describe it, brisk-aitesting can test it today.</strong><br />
          <em>If it needs a special runtime, add a custom engine and keep the same planning/result contract.</em>
        </blockquote>
      </td>
    </tr>
  </table>
</div>

## 🏗️ Architecture

```mermaid
flowchart TD
  A["🎯 User goal: what should be tested?"] --> B["⚙️ Config"]
  B --> C["🔍 Discovery"]
  C --> C1["📂 Repo signals"]
  C --> C2["🌐 UI routes"]
  C --> C3["🛣️ API routes"]
  C --> C4["📜 OpenAPI JSON/YAML contracts"]

  C --> D["🧠 Planner"]
  D --> D1["🤖 AI returns structured JSON plan"]
  D --> D2["📋 Built-in planner creates contract scenarios"]

  D1 --> E["✅ Validation"]
  D2 --> E
  E -->|❌ invalid| F["🔧 Repair feedback loop"]
  F --> D
  E -->|✅ valid| G["🎯 Optional UI route grounding"]

  G --> H["🤖 AI action enrichment from real page evidence"]
  H --> I["🚦 Engine router"]
  E -->|no UI grounding needed| I

  I --> J["🎭 Playwright UI engine"]
  I --> K["📡 API engine"]
  I --> L["📋 Contract engine"]
  I --> M["🧩 Custom engines"]

  J --> N["📎 Evidence artifacts"]
  K --> N
  L --> N
  M --> N

  N --> O["📦 brisk-aitesting.result.v1"]
  O --> P["🏠 Host app"]
  P --> P1["🔄 CI"]
  P --> P2["📊 Dashboard"]
  P --> P3["🗄️ Database"]
  P --> P4["📈 Observability"]
```

<br />

### Core Rule

<div align="center">
  <table>
    <tr>
      <td align="center" width="25%"><strong>🧠 AI plans.</strong></td>
      <td align="center" width="25%"><strong>✅ Validators decide</strong> if the plan is executable.</td>
      <td align="center" width="25%"><strong>⚙️ Engines execute.</strong></td>
      <td align="center" width="25%"><strong>📎 Evidence</strong> proves what happened.</td>
    </tr>
    <tr>
      <td align="center" colspan="4"><strong>🏠 The host app owns storage and presentation.</strong></td>
    </tr>
  </table>
</div>

## Documentation

| Guide | Use it when |
|:------|:------------|
| [Getting Started](./docs/GETTING_STARTED.md) | You want the fastest path from install to first run |
| [Host Integration](./docs/HOST_INTEGRATION.md) | You want to embed brisk-aitesting into an existing product without duplicating its settings, authentication, or AI connection |
| [Configuration](./docs/CONFIGURATION.md) | You need app, auth, AI, runtime, discovery, or host-config setup |
| [API Reference](./docs/API_REFERENCE.md) | You are embedding Brisk through the SDK |
| [Security](./docs/SECURITY.md) | You need to understand data flow, AI boundaries, artifacts, and network policy |
| [Compatibility](./docs/COMPATIBILITY.md) | You want to know where Brisk works best today |
| [Cross-Architecture Proof](./docs/CROSS_ARCHITECTURE_PROOF.md) | You want to understand what Directus, Medusa, and n8n prove and what remains open |
| [Real-System Proof Log](./docs/engineering/REAL_SYSTEM_PROOF_LOG.md) | You want exact dated tests, reasons, results, defects, corrections, counts, and exclusions |
| [Real-System Change Gate](./docs/engineering/REAL_SYSTEM_CHANGE_GATE.md) | You are changing product behavior and must test the three minimum real architectures |
| [Real-System Target Depth](./docs/engineering/REAL_SYSTEM_TARGET_DEPTH.md) | You want live page/element/API/contract denominators, honest executed coverage, secondary source context, and required expansion |
| [Real AI Pipeline](./docs/engineering/REAL_SYSTEM_AI_PIPELINE.md) | You want to know exactly what AI chooses, what safe code controls, what has actually run, and what remains at zero |
| [Competitive Comparison](https://github.com/oshjain/brisk-aitesting/blob/main/docs/COMPETITIVE_COMPARISON.md) | You want the sourced Brisk-vs-market feature matrix |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | A run failed and you need a direct fix |
| [Release](https://github.com/oshjain/brisk-aitesting/blob/main/docs/RELEASE.md) | You are publishing or validating a release |

## 📦 Install

<table>
  <tr>
    <td width="33%" valign="top" align="center">

### 🌟 npm Install

```bash
npm install "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>"
```

For pnpm monorepos, install it in the backend package that will run discovery, AI planning, engines, and artifact writing:

```bash
pnpm add "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>" --filter <your-backend-package>
```

Example:

```bash
pnpm add "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>" --filter @your-org/api
```

Then create a config:

```bash
npx brisk-aitesting init
```

If your project already installs Playwright and browser binaries, keep using your existing setup. If it does not, add Playwright to the same backend/runtime package:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

    </td>
    <td width="33%" valign="top" align="center">

### 🛠️ Local Development Install

<sub>For contributors:</sub>

```bash
git clone https://github.com/oshjain/brisk-aitesting.git
cd brisk-aitesting
npm install
npm run build
npm link
```

Inside a host app:

```bash
npm link brisk-aitesting
```

    </td>
    <td width="33%" valign="top" align="center">

### 🐙 GitHub Install

```bash
npm install github:oshjain/brisk-aitesting
```

    </td>
  </tr>
</table>

### Core Install vs Enhanced Adapters

The default package is intentionally lightweight:

```bash
npm install "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>"
```

That installs the core testing layer:

| Included by default | What it means |
|:--------------------|:--------------|
| AI planning contract | AI creates structured JSON plans, not executable code. |
| Plan validation and repair | Bad plans are blocked or repaired before engines run. |
| Repo and route discovery | Brisk inspects supported local app structure and routes. |
| UI engine | Browser checks through Playwright when the host project has Playwright available. |
| API engine | HTTP checks, status checks, JSON checks, headers, and evidence. |
| OpenAPI parsing | JSON/YAML OpenAPI reading, operation summaries, and schema-backed checks. |
| Built-in schema fuzzing | Lightweight malformed-request checks from OpenAPI schemas. |
| Replay engine | Reruns declared HTTP interactions. |
| Message contract inspection | Reads AsyncAPI-style message contracts and records evidence. |
| Handover result | One stable result JSON for dashboards, databases, CI, and internal tools. |

Enhanced third-party adapters are real, but they are not forced into every install because they are heavy and may need extra runtimes:

| Enhanced adapter | Install when you need it | Why it is separate |
|:-----------------|:-------------------------|:-------------------|
| Specmatic contract execution and mock/service virtualization | `npm install specmatic` plus Java | Specmatic is a large runtime and Java is required by the tool. |
| Pact message verification | `npm install @pact-foundation/pact` | Pact is only needed for teams using Pact contracts. |
| Schemathesis deep OpenAPI fuzzing | Python plus Schemathesis installed on the machine | Schemathesis is a Python runtime, not a normal npm dependency. |

For pnpm monorepos, install enhanced adapters in the same backend package that runs `brisk-aitesting`:

```bash
pnpm add specmatic --filter <your-backend-package>
pnpm add @pact-foundation/pact --filter <your-backend-package>
```

Example:

```bash
pnpm add specmatic --filter @your-org/api
```

If an enhanced adapter is used without its runtime, Brisk returns a setup error instead of pretending the adapter ran.

## ⚡ Quick Start

### Optional Adapter Runtimes

The npm package ships adapter code. Heavy third-party runtimes are installed only by teams that actually use those adapters.

| Adapter | What ships with Brisk | What users install only if needed |
|:--------|:----------------------|:----------------------------------|
| Specmatic | `SpecmaticContractEngine`, workflow, evidence contract | `specmatic` in the host runtime package plus Java |
| Pact | `PactMessageEngine`, workflow, evidence contract | `@pact-foundation/pact` in the host runtime package |
| Schemathesis | `SchemathesisOpenApiFuzzEngine`, workflow, evidence contract | Python plus Schemathesis on the machine |

Specmatic can test any HTTP/OpenAPI provider. The app under test does not have to be Java. Java is needed because the Specmatic runtime itself is Java-based.

<details open>
<summary><strong>1️⃣ Create your config</strong></summary>

Create `brisk-aitesting.config.mjs`:

```js
import { defineHostConfig } from 'brisk-aitesting';

export default defineHostConfig({
  app: {
    name: 'My SaaS',
    baseUrl: 'http://localhost:3000',
    repoPath: '.',
  },
});
```

Optional AI, auth, and execution values come from `.env.brisk-aitesting`.
Preview is the default; real execution must be explicitly enabled.

</details>

<details open>
<summary><strong>2️⃣ Run a test goal</strong></summary>

```bash
npx brisk-aitesting run \
  --goal "Test login, permissions, dashboard, API contracts, and critical workflows" \
  --scenarios 15 \
  --mode automatic \
  --ui-action-feedback when-missing
```

</details>

<details open>
<summary><strong>3️⃣ Get machine-readable output</strong></summary>

```bash
npx brisk-aitesting run \
  --goal "Test OpenAPI contracts and critical API paths" \
  --scenarios 10 \
  --json \
  --output .brisk-aitesting/latest-result.json
```

</details>

<br />

### CLI Exit Codes

| Code | Meaning |
|:----:|:--------|
| `0` | ✅ Run completed and **passed** |
| `1` | ❌ Run completed but **failed, errored, or skipped** |
| `2` | ⚠️ **Usage, config, provider, or runtime setup error** |

## 🤖 AI Provider Setup

Use the `BRISK_AITESTING_*` namespace for product configuration:

<br />

### Quick Environment Config

```bash
BRISK_AITESTING_AI_PROVIDER=openai
BRISK_AITESTING_AI_MODEL=your-model
BRISK_AITESTING_AI_API_KEY=your-api-key
```

<br />

### OpenAI-Compatible Providers

For any OpenAI-compatible provider or internal gateway:

```ts
ai: {
  provider: 'openai-compatible',
  endpoint: requiredEnv('BRISK_AITESTING_AI_ENDPOINT'),
  model: requiredEnv('BRISK_AITESTING_AI_MODEL'),
  apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY',
}
```

<br />

### Provider Config Reference

| Property | Type | Description |
|:---------|:----:|:------------|
| `provider` | `string` | Built-in provider adapter name |
| `endpoint` | `string` | Optional chat-completions endpoint for OpenAI-compatible gateways |
| `model` | `string` | Model name controlled by your environment |
| `apiKeyEnv` | `string` | Environment variable name that stores the key |
| `apiKey` | `string` | Direct key for advanced host-managed setups |
| `caCertPath` | `string` | Optional PEM file for enterprise TLS trust |
| `maxTokens` | `number` | Maximum AI response size |
| `temperature` | `number` | Generation temperature |
| `repairAttempts` | `number` | How many times invalid AI plans can be repaired |

> 📝 **Note:** Provider-specific environment variables are compatibility aliases only. Product integrations should prefer `BRISK_AITESTING_*`.

## 🔌 Add It to Any Host Application

Normal integration does not require a custom type, mapper, engine list, or
security configuration.

### Environment-only

Create `.env.brisk-aitesting`:

```bash
BRISK_AITESTING_APP_NAME=My Application
BRISK_AITESTING_BASE_URL=http://localhost:3000
BRISK_AITESTING_REPO_PATH=.
BRISK_AITESTING_EXECUTION=preview

BRISK_AITESTING_AI_PROVIDER=openai-compatible
BRISK_AITESTING_AI_MODEL=my-model
BRISK_AITESTING_AI_ENDPOINT=https://my-provider.example.com/v1
BRISK_AITESTING_AI_API_KEY=your-secret
```

Then run:

```bash
npx brisk-aitesting doctor
npx brisk-aitesting run "Test login, dashboard, APIs, and permissions"
```

### Ready host object

```ts
import { defineHostConfig } from 'brisk-aitesting';

export default defineHostConfig({
  app: {
    name: 'My Application',
    baseUrl: 'http://localhost:3000',
  },
});
```

`defineHostConfig` reads optional AI/auth settings from the documented
`BRISK_AITESTING_*` environment names and supplies safe discovery, browser,
engine, artifact, and security defaults. Explicit object values win over the
environment. Preview is the default; set `BRISK_AITESTING_EXECUTION=enabled`
only when the target and cleanup path are ready for real changes.

An existing host AI connection can be passed directly through its common
`name` and `complete(request)` interface. An existing host can also provide one
`createSession()` function for short-lived execution authentication.

`defineConfigFromHost` remains available in the
[advanced host guide](docs/HOST_INTEGRATION.md#advanced-mapping), but it is not
required for normal onboarding.

## 🛡️ How AI Is Controlled

AI does **not** write trusted executable scripts directly.

<br />

### The Pipeline

The default AI planner returns non-executable intent shaped as `brisk-aitesting.intent.v1`. Deterministic code then proves and compiles that intent:

<table>
  <tr>
    <td align="center">1️⃣</td>
    <td>📦</td>
    <td><strong>Validates intent</strong> with strict structured output</td>
  </tr>
  <tr>
    <td align="center">2️⃣</td>
    <td>🔄</td>
    <td><strong>Collects evidence</strong> from capability adapters</td>
  </tr>
  <tr>
    <td align="center">3️⃣</td>
    <td>🛣️</td>
    <td><strong>Compiles</strong> typed operations and dependencies</td>
  </tr>
  <tr>
    <td align="center">4️⃣</td>
    <td>✅</td>
    <td><strong>Proves</strong> authority, inputs, outcomes, and cleanup</td>
  </tr>
  <tr>
    <td align="center">5️⃣</td>
    <td>🔧</td>
    <td><strong>Lowers</strong> the proven workflow through an adapter</td>
  </tr>
  <tr>
    <td align="center">6️⃣</td>
    <td>🎯</td>
    <td><strong>Grounds</strong> UI steps against real page evidence</td>
  </tr>
  <tr>
    <td align="center">7️⃣</td>
    <td>🚦</td>
    <td><strong>Routes</strong> each scenario to the right engine</td>
  </tr>
</table>

<br />

### The Safety Model

| Principle | Guard |
|:---------:|:------|
| 🤖 AI can **suggest** what should be tested | ✅ Allowed |
| 🤖 AI can **choose** whether a scenario is UI, API, contract, schema, replay, message, or custom | ✅ Allowed |
| 🤖 AI can **enrich UI actions** only from captured page evidence | ✅ Allowed |
| ❌ AI cannot **invent selectors** and force execution | 🚫 Blocked |
| ❌ AI cannot **bypass validation** | 🚫 Blocked |
| ⚙️ Engines produce **evidence** for executable results | ✅ Required by contract |

## ⚙️ Built-In Engines

<table>
  <tr>
    <td width="33%" valign="top" align="center">
      <h3>🎭 Playwright Engine</h3>
      <p><code>BuiltinPlaywrightEngine</code></p>
      <p>Runs browser workflows and grounded UI actions.</p>
    </td>
    <td width="33%" valign="top" align="center">
      <h3>📡 API Engine</h3>
      <p><code>BuiltinApiEngine</code></p>
      <p>Runs HTTP checks and validates response schemas when OpenAPI schemas exist.</p>
    </td>
    <td width="33%" valign="top" align="center">
      <h3>📋 Contract Engine</h3>
      <p><code>BuiltinContractEngine</code></p>
      <p>Reads OpenAPI JSON/YAML and emits operation summaries.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" align="center">
      <h3>🧬 Schema Fuzz Engine</h3>
      <p><code>BuiltinSchemaFuzzEngine</code></p>
      <p>Sends malformed OpenAPI request examples and expects safe API rejection.</p>
    </td>
    <td width="50%" valign="top" align="center">
      <h3>🔁 Replay Engine</h3>
      <p><code>BuiltinReplayEngine</code></p>
      <p>Reruns declared HTTP interactions and records response evidence.</p>
    </td>
  </tr>
</table>

<br />

> 🧩 **Extensible.** Built-in engines cover UI, API, contract, schema fuzzing, declared HTTP replay, AsyncAPI message-contract inspection, plus optional Schemathesis, Specmatic, and Pact adapters. Custom engines can still be plugged in for database, live brokers, mobile, or enterprise-specific systems.

### 🏭 Controlled Factory Line

The product is built around a controlled execution line:

```text
1. Understand the app
2. Discover pages, APIs, routes, contracts, and schemas
3. Create a structured test plan
4. Normalize and validate the test plan
5. Repair invalid plans when possible
6. Route each scenario to the correct engine
7. Generate executable artifacts through engines
8. Run the scenario
9. Collect logs, traces, screenshots, request/response evidence, and contract evidence
10. Return one final result envelope
```

That is the reliability model: AI proposes, Brisk checks, engines run, evidence records.

## 📋 Handover Contract

`brisk-aitesting` does **not** require a database.

It returns **one stable object** that any host system can store, split, render, or send to CI:

<br />

```ts
{
  schemaVersion: 'brisk-aitesting.result.v1',
  runId: string,
  status: 'passed' | 'failed' | 'error' | 'skipped',
  summary: {
    total: number,
    passed: number,
    failed: number,
    skipped: number,
    errors: number,
    passRate: number,
    durationMs: number
  },
  plan: {},
  tests: [],
  artifacts: [],
  diagnosis: [],
  handover: {}
}
```

<br />

### Your SaaS Can Use This Result For

<table>
  <tr>
    <td align="center">🔄</td>
    <td><strong>CI pass/fail gates</strong></td>
    <td align="center">📊</td>
    <td><strong>Dashboard cards</strong></td>
  </tr>
  <tr>
    <td align="center">📚</td>
    <td><strong>Test history</strong></td>
    <td align="center">💾</td>
    <td><strong>Database persistence</strong></td>
  </tr>
  <tr>
    <td align="center">📝</td>
    <td><strong>Audit logs</strong></td>
    <td align="center">🖼️</td>
    <td><strong>Traces and screenshots</strong></td>
  </tr>
  <tr>
    <td align="center">📈</td>
    <td><strong>Analytics</strong></td>
    <td></td>
    <td></td>
  </tr>
</table>

This may be the most valuable part of the product for enterprise teams. The result envelope can be written to BigQuery, Cloud Storage, GitHub Actions, an internal test portal, release approval workflows, incident-management systems, or any dashboard the host team already owns.

## 📐 Stable Schemas

<div align="center">

| Schema | Version |
|:-------|:-------:|
| `brisk-aitesting.intent.v1` | Semantic Intent |
| `brisk-aitesting.evidence-graph.v1` | Capability Evidence |
| `brisk-aitesting.workflow.v1` | Compiled Workflow |
| `brisk-aitesting.compilation.v1` | Compilation Outcome |
| `brisk-aitesting.lowered-plan.v1` | Lowered Engine Plan |
| `brisk-aitesting.plan.v1` | 📋 Plan |
| `brisk-aitesting.validation.v1` | ✅ Validation |
| `brisk-aitesting.discovery.v1` | 🔍 Discovery |
| `brisk-aitesting.contract-drift.v1` | Contract Drift |
| `brisk-aitesting.result.v1` | 📦 Result |
| `brisk-aitesting.handover.v1` | 🤝 Handover |
| `brisk-aitesting.cli-result.v1` | ⌨️ CLI Result |
| `brisk-aitesting.inspect-result.v1` | Inspect Result |
| `brisk-aitesting.clean-result.v1` | Cleanup Result |
| `brisk-aitesting.doctor-result.v1` | Doctor Result |
| `brisk-aitesting.benchmark.v1` | 📊 Benchmark |
| `brisk-aitesting.pack-check.v1` | 📦 Pack Check |
| `brisk-aitesting.release-readiness.v1` | Release Readiness |
| `brisk-aitesting.adapter-manifest.v1` | Adapter Manifest |
| `brisk-aitesting.adapter-readiness.v1` | Adapter Readiness |
| `brisk-aitesting.engine-conformance.v1` | Engine Conformance |
| `brisk-aitesting.plugin-conformance.v1` | Plugin Conformance |
| `brisk-aitesting.plugin-conformance-smoke.v1` | Plugin Quality Health Check |
| `brisk-aitesting.extension-conformance.v1` | Extension Conformance |
| `brisk-aitesting.extension-conformance-smoke.v1` | Extension Quality Health Check |
| `brisk-aitesting.schemathesis-evidence.v1` | Schemathesis Evidence |
| `brisk-aitesting.schemathesis-smoke.v1` | Schemathesis Health Check |
| `brisk-aitesting.specmatic-evidence.v1` | Specmatic Evidence |
| `brisk-aitesting.specmatic-smoke.v1` | Specmatic Health Check |
| `brisk-aitesting.reference-serious-saas.v1` | Serious SaaS Proof App |
| `brisk-aitesting.reference-proof-apps.v1` | Reference Proof Apps |
| `brisk-aitesting.golden-fixtures.v1` | Golden Expected Outputs |
| `brisk-aitesting.junit-report.v1` | JUnit Report |
| `brisk-aitesting.html-report.v1` | HTML Report |
| `brisk-aitesting.schema-fuzz-evidence.v1` | Schema Fuzz Evidence |
| `brisk-aitesting.replay-evidence.v1` | Replay Evidence |
| `brisk-aitesting.api-evidence.v1` | 📡 API Evidence |
| `brisk-aitesting.message-contract-evidence.v1` | Message Contract Evidence |
| `brisk-aitesting.live-message-evidence.v1` | Live Message Evidence |
| `brisk-aitesting.pact-message-evidence.v1` | Pact Message Evidence |
| `brisk-aitesting.pact-message-smoke.v1` | Pact Message Health Check |
| `brisk-aitesting.openapi-summary.v1` | 📜 OpenAPI Summary |
| `brisk-aitesting.playwright-evidence.v1` | 🎭 Playwright Evidence |
| `brisk-aitesting.ui-grounding.v1` | 🎯 UI Grounding |
| `brisk-aitesting.ui-actions.v1` | 🖱️ UI Actions |
| `brisk-aitesting.ui-healing.v1` | UI Healing |

</div>

## 🚪 Release Gate

Before a release, run the full gate:

<br />

```bash
npm run typecheck  &&  npm run build  &&  npm run smoke:ci  &&  npm run benchmark  &&  npm run smoke:real-ai
```

<br />

### Gate Checks Explained

<table>
  <tr>
    <td width="25%" align="center"><h3>🔍 <code>typecheck</code></h3></td>
    <td width="25%" align="center"><h3>🏗️ <code>build</code></h3></td>
    <td width="25%" align="center"><h3>🧪 <code>smoke:ci</code></h3></td>
    <td width="25%" align="center"><h3>📊 <code>benchmark</code></h3></td>
  </tr>
  <tr>
    <td align="center">TypeScript type validation</td>
    <td align="center">Production build</td>
    <td align="center">Automated release health checks</td>
    <td align="center">Bad-input safety checks</td>
  </tr>
  <tr>
    <td colspan="4" align="center"><h3>🤖 <code>smoke:real-ai</code></h3></td>
  </tr>
  <tr>
    <td colspan="4" align="center">Uses a real configured AI provider. Kept separate from normal CI because enterprise networks may require custom certificates or provider routing.</td>
  </tr>
</table>

<br />

#### What The Release Check Actually Does

Some command names are developer shorthand, so here is the plain meaning:

| Word | Plain meaning |
|:-----|:--------------|
| Smoke test | A quick health check. Like switching on a machine and checking that the main parts start correctly. |
| Real AI smoke | A quick health check that uses an actual configured AI provider instead of a fake response. |
| Conformance | A quality contract. It means an engine or plugin must behave in the exact shape Brisk expects before we trust it. |
| Reference app | A small sample application we built inside this project to practice against. It exercises the engines, but it is not a real product; proof against real products (Directus, Medusa, n8n) is recorded separately with dates. |
| Golden fixture | A known-good saved answer. If Brisk changes that answer later, we review why. |
| Failure mode proof | A test that intentionally feeds bad input, missing config, broken schemas, or unsafe behavior to prove Brisk fails safely. |

#### What `smoke:ci` Checks

| Check | Description |
|:-----:|:------------|
| Contract/schema registry checks | Make sure every public JSON shape Brisk promises is still documented and exported. |
| Built-in engine quality checks | Make sure Playwright, API, contract, schema fuzz, replay, and message engines run correctly and return the same clean result shape. |
| External engine quality checks | Make sure third-party engines cannot claim support unless they route correctly, time out safely, and avoid obvious secret leakage. |
| Non-engine extension quality checks | Make sure custom discovery, planning, validation, UI grounding, and AI provider extensions return the shapes Brisk expects. |
| Adapter readiness checks | Make sure every adapter marked "built" has its declared code, docs, package files, and CI wiring present. This is a file-presence check only - it does not run the adapter. Working proof comes from the execution smokes (smoke:pact in CI; smoke:schemathesis and smoke:specmatic run by hand because they need Python/Java). |
| Serious SaaS proof app checks | Run Brisk against a real SaaS-style app with auth, roles, UI, API, OpenAPI, negative cases, state changes, and artifacts. |
| Reference proof app checks | Run Brisk against API-only, Todo, multi-tenant, e-commerce, and event/messaging apps so the product is proven across more than one app shape. |
| Golden expected-output checks | Compare today's output with known-good output so quiet weakening is caught. |
| CLI checks | Make sure command-line usage returns the right exit codes and JSON. |
| AI repair checks | Make sure invalid AI plans are rejected or repaired instead of being blindly executed. |
| Full engine health checks | Make sure all built-in engines start, run, and save evidence. |
| npm package safety checks | Make sure the package can ship without source clutter, secrets, local test artifacts, or missing files. |
| Release readiness checks | Make sure the current version has a changelog entry and the release scripts/docs are present. |

Optional deep OpenAPI adapter check:

```bash
npm run smoke:schemathesis
```

This runs the real Schemathesis OpenAPI deep API checker against the serious SaaS proof app. In simple words: it reads the OpenAPI file, sends many valid and invalid API requests, and reports whether the live API behaves like the contract says it should. It needs Python plus the Schemathesis package installed.

The adapter is exported as `SchemathesisOpenApiFuzzEngine`:

```ts
import { SchemathesisOpenApiFuzzEngine } from 'brisk-aitesting';
```

Optional Specmatic contract adapter check:

```bash
npm run smoke:specmatic
```

This runs the real Specmatic CLI when Java and Specmatic are available. In simple words: Specmatic reads the OpenAPI contract, sends provider contract checks to the running API, can run Specmatic mock mode for service virtualization, and Brisk records the logs/reports/evidence in one result shape.

The adapter is exported as `SpecmaticContractEngine`:

```ts
import { SpecmaticContractEngine } from 'brisk-aitesting';
```

Optional Pact message adapter check:

```bash
npm run smoke:pact
```

This runs real Pact message verification against the event/messaging proof app. In simple words: Pact checks that the provider can produce the event message a consumer contract expects, and Brisk records the result as `brisk-aitesting.pact-message-evidence.v1`.

The adapter is exported as `PactMessageEngine`:

```ts
import { PactMessageEngine } from 'brisk-aitesting';
```


Adapter readiness is not trusted by text alone. `smoke:adapter-readiness` reads `adapters/manifest.json` and checks the adapter like a shipping checklist: source code exists, exports exist, docs mention it, package includes it, CI can run it, proof-app coverage exists, quality checks pass, and evidence is saved. It emits `brisk-aitesting.adapter-readiness.v1` for machines to read.

#### What `benchmark` Checks

| Check | Description |
|:-----:|:------------|
| Config safety | Brisk should reject missing app settings, unsafe API-key handling, and invalid retry settings. |
| Broken contract files | Brisk should explain the problem instead of crashing. |
| OpenAPI and schema behavior | Brisk should parse JSON/YAML contracts, resolve nested refs, and create valid/invalid schema examples. |
| Contract drift | Brisk should report implemented-but-undocumented, documented-but-missing, and matched API routes. |
| Bad AI output | Brisk should repair common AI formatting issues, normalize aliases, and reject unsafe plan shapes. |
| Plan validation | Brisk should block duplicate IDs, invalid routes, bad UI evidence IDs, unsupported message targets, and extra fields. |
| API execution | Brisk should check status values, response bodies, text responses, OpenAPI schemas, and rejected-action unchanged state. |
| Replay | Brisk should rerun declared HTTP interactions and skip empty replay plans clearly. |
| Blocked network calls | Brisk should respect the configured network boundary. |
| CLI setup errors | Brisk should give clear setup errors and the right exit code. |

## 📈 Current Status

<br />

### ✅ Built

<table>
  <tr>
    <td>🧠</td>
    <td>AI planning with checked JSON plans</td>
    <td>🔄</td>
    <td>Validation and repair loop</td>
  </tr>
  <tr>
    <td>🛣️</td>
    <td>Route discovery</td>
    <td>📜</td>
    <td>OpenAPI JSON/YAML support</td>
  </tr>
  <tr>
    <td>🔢</td>
    <td>Generated API contract scenarios</td>
    <td>✅</td>
    <td>Response schema validation with AJV</td>
  </tr>
  <tr>
    <td>🎯</td>
    <td>Grounded UI action execution</td>
    <td>⚙️</td>
    <td>Playwright / API / Contract / Schema / Replay engines</td>
  </tr>
  <tr>
    <td>⌨️</td>
    <td>CLI with stable exit codes</td>
    <td>🤝</td>
    <td>Handover JSON contract</td>
  </tr>
  <tr>
    <td>🧪</td>
    <td>Deterministic CI gate</td>
    <td>📊</td>
    <td>Bad-input safety suite</td>
  </tr>
  <tr>
    <td>📦</td>
    <td>npm pack safety check</td>
    <td>Engine quality suite</td>
    <td>Built-in engines return stable result and artifact shapes</td>
  </tr>
  <tr>
    <td>📄</td>
    <td>JUnit and HTML reports</td>
    <td>🧹</td>
    <td>Cleanup command with dry-run and JSON output</td>
  </tr>
  <tr>
    <td>🧬</td>
    <td>Built-in schema fuzz engine</td>
    <td>📜</td>
    <td>Fast OpenAPI malformed-request checks</td>
  </tr>
  <tr>
    <td>🔁</td>
    <td>Built-in replay engine</td>
    <td>📜</td>
    <td>Declared HTTP interaction replay with evidence</td>
  </tr>
  <tr>
    <td>🤖</td>
    <td>Real AI provider check</td>
    <td>🤖</td>
    <td>npm package publication path</td>
  </tr>
  <tr>
    <td>🧪</td>
    <td>API-only, Todo, multi-tenant, e-commerce, and event/messaging proof apps</td>
    <td>🔌</td>
    <td>Non-engine extension quality checks</td>
  </tr>
  <tr>
    <td>📦</td>
    <td>Release readiness automation</td>
    <td>📝</td>
    <td>Versioned changelog</td>
  </tr>
</table>

<br />

### 🔮 Still Future Work

<table>
  <tr>
    <td>📦</td>
    <td>Multi-provider benchmark scoring</td>
    <td>🏆</td>
    <td>Built-in analytics module</td>
  </tr>
  <tr>
    <td>📊</td>
    <td>More framework-specific examples</td>
    <td>📚</td>
    <td>More golden expected outputs</td>
  </tr>
  <tr>
    <td>🧪</td>
    <td>More enterprise proof apps</td>
    <td>🔁</td>
    <td>Richer replay diff artifacts</td>
  </tr>
  <tr>
    <td>📨</td>
    <td>Broker-specific message adapters beyond AsyncAPI, live-message hooks, and Pact files</td>
    <td>🩹</td>
    <td>Deeper multi-page UI resilience and flake analysis</td>
  </tr>
  <tr>
    <td>⚖️</td>
    <td>Scenario/rule coverage and contradiction checks when users provide rule IDs or structured expectations</td>
    <td></td>
    <td></td>
  </tr>
</table>

<hr />

## 👥 Contributors

<div align="center">
  <table>
    <tr>
      <td align="center">
        <strong>Hasmukh Jain</strong><br />
        <sub>Main contributor &amp; product visionary</sub>
      </td>
    </tr>
  </table>
</div>

## 📄 License

<div align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
  <br />
  <sub>MIT &copy; Hasmukh Jain</sub>
</div>
