# Plumb — Complete Features & Functions Catalog

> **For:** Technical Architect · **Source:** Plumb Master Plan (461-line synthesis of 9 specialist agents) · **Version:** 1.0

This catalog enumerates every function the Plumb platform must deliver, organized by product, with dependencies, data touched, and release phase. Use it to scope architecture, estimate effort, and assign workstreams.

---

## How to read this document

| Column | Meaning |
|---|---|
| **ID** | Stable identifier — reference in tickets, designs, and code (`F-01-01`) |
| **Function** | What the system does |
| **Data** | Core entities touched |
| **Phase** | P0 (built) · P1 (MVP) · P2 (Beta) · P3 (GA) · P4 (Scale) |

---

# 1. Plumb Capture (360° reality capture)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-01-01 | Multi-source capture | Smartphone, Insta360 X4, Ricoh Theta Z1, Matterport Pro3, GoPro MAX, iPhone Pro pano, drones, laser scans | Capture, CaptureFrame | P1 |
| F-01-02 | Auto-mapping to plans | Image-to-plan alignment: DINOv2 embeddings + PnP with floorplan priors + visual relocalization against prior captures | Floorplan, CaptureFrame, Pose | P1 |
| F-01-03 | On-device redaction | Face/plate blur at capture time (Apple Neural Engine / NNAPI) | Capture, Asset | P1 |
| F-01-04 | ARKit/ARCore visual relocalization | Anchor captures to physical space using device AR | Pose, Capture | P2 |
| F-01-05 | 3D Gaussian Splatting rooms | Photoreal novel-view from sparse captures; per-room 10–50 MB | 3DGS Asset | P3 |
| F-01-06 | QuickCodes | Physical QR codes that auto-tag floor/area on capture | Capture, Floorplan | P1 |
| F-01-07 | Coverage confirmation | Real-time coverage % vs plan during walk; coverage heatmap | Capture, Pose | P1 |
| F-01-08 | Split View / Reveal Mode | Two-pane capture-vs-BIM sync; reveal slider wipe | Capture, BIMModel | P1 |
| F-01-09 | Timeline scrub | Scrub through 6 months of captures per space | Capture | P1 |
| F-01-10 | Offline capture + resumable upload | SQLite-first, chunked + resumable + content-hash dedup, BGTaskScheduler/WorkManager | Capture, SyncState | P1 |
| F-01-11 | Capture pipeline (DAG) | Decode → SuperPoint → SfM (GLOMAP) → MVS (OpenMVS) → Poisson mesh → 3DGS → SAM-2 → BIM alignment, with backpressure + DLQ | PipelineRun, Artifact | P1 |

---

# 2. Plumb Field (field notes & issues)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-02-01 | Rich-text field notes | Text + photo + sketch + voice memo + attachments | FieldNote, Attachment | P1 |
| F-02-02 | On-device Whisper dictation | ASR offline; auto floor/area tag via indoor positioning | FieldNote | P2 |
| F-02-03 | Sketch-on-BIM | Draw annotations directly on BIM model view | Annotation | P2 |
| F-02-04 | Issue tracking board | Kanban + list; severity, assignee, due, area, type filters; drag-to-reassign | Issue, IssueComment | P2 |
| F-02-05 | Photo with QuickCode | Auto-tag location from QR; upload with note | Attachment | P1 |
| F-02-06 | Offline-first sync | LocalID (UUIDv7) → ServerID; idempotent via clientId + contentHash; Lamport timestamps | FieldNote, SyncState | P1 |
| F-02-07 | Indoor positioning | Wi-Fi RTT + BLE + UWB + AR visual loc → automatic floor/area tagging | Pose | P2 |
| F-02-08 | Voice memos | Record, transcribe (server or device), attach to note | Attachment | P1 |
| F-02-09 | Punch list / task assignment | Assigned tasks with one-tap photo proof (subcontractor foreman persona) | Issue, Task | P2 |

---

# 3. Plumb Track (progress tracking)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-03-01 | BIM-vs-reality percent complete | Per-trade / floor / area with β-distributed confidence intervals (±3% abs, ±5% rel vs hand count) | ProgressSnapshot | P2 |
| F-03-02 | EV S-curve & Gantt | Earned-value curves, schedule Gantt on canvas | ProgressSnapshot, Schedule | P2 |
| F-03-03 | Trade × floor heatmap | Visual percent-complete matrix | ProgressSnapshot | P2 |
| F-03-04 | Schedule risk forecast | Risk vs impact scatter; weather impact signals | Schedule, Risk | P2 |
| F-03-05 | Cost-code rollup | Progress → cost code mapping for estimators | CostCode | P3 |
| F-03-06 | Auto-quantities | Quantities from aligned captures + BIM for change orders | Quantity | P3 |

---

# 4. Plumb Air (drone coordination)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-04-01 | Drone capture ingest | DJI / Arducopter / Auterion SDK; PPK/RTK georeferencing | Capture | P2 |
| F-04-02 | Photogrammetry | OpenDroneMap: orthomosaic + DSM + point cloud | Asset, Ortho | P2 |
| F-04-03 | Volumetric/area measurement | Measure stockpiles, cut/fill from ortho + DSM | Measurement | P2 |
| F-04-04 | LAANC integration | Airspace authorization at flight-planning step | FlightPlan | P2 |
| F-04-05 | BVLOS-aware flight logs | FAA Part 107 compliance logging | FlightLog | P2 |
| F-04-06 | Drone-in-a-Box | DJI Dock / Skydio Dock scheduled autonomous flights | FlightPlan, Capture | P4 |

---

# 5. Plumb Model (BIM coordination, was "BIM+")

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-05-01 | Federated BIM viewing | glTF + IFC (2x3/4/4.3) + NWD via Forge Data Exchange | BIMModel | P2 |
| F-05-02 | Clash heatmap | AI-ranked clash detection (BIM vs BIM, BIM vs point cloud) | Clash | P2 |
| F-05-03 | BCF 3.0 import/export | BCF topics round-trip with other tools | BcfTopic | P2 |
| F-05-04 | Design-intent delta diff | Compare design vs as-built delta | DeltaDiff | P2 |
| F-05-05 | AR overlay on site | BIM overlaid on live camera; see-through-walls verification | BIMModel, Pose | P3 |
| F-05-06 | Generative base model | Auto-generate base BIM from floorplan when no model exists | BIMModel | P3 |
| F-05-07 | Section planes & measurement | Slice model; measure in 3D | Measurement | P2 |
| F-05-08 | 2D/3D side-by-side | Sheet vs model comparison | BIMModel, Sheet | P2 |

---

# 6. Plumb Copilot (AI assistant)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-06-01 | Function-calling LLM | Tools: query captures, spatial query, diff captures, create issue, generate report, draft RFI, summarize progress, measure | ProjectGraph | P2 |
| F-06-02 | Citations mandatory | Refusal-on-no-citation; every claim resolves to a project artifact | Citation | P2 |
| F-06-03 | RAG over project graph | Hybrid BM25 + dense (pgvector/OpenSearch); reranker | Embedding | P2 |
| F-06-04 | Streaming chat UI | SSE deltas; tool-call UI; full-screen chat + canvas | — | P2 |
| F-06-05 | Voice mode | Whisper ASR + TTS; barge-in | — | P3 |
| F-06-06 | Safety pipeline | PII redactor → prompt firewall → context quarantine → tenant-pinned inference; content classifier → PII inverse → C2PA provenance | AuditLog | P2 |
| F-06-07 | Report generation | Auto board decks, RFI packs, change-order bundles | Report | P2 |
| F-06-08 | Regional inference | EU/JP/KSA data-residency inference (SageMaker/Llama on-prem) | — | P4 |

---

# 7. Plumb Voice (hands-free)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-07-01 | "Hey Plumb" wake word | On-device, low-power always-listening | — | P1 (EN) / P2 (multi) |
| F-07-02 | On-device ASR | Whisper tiny/base; offline dictation | — | P1 |
| F-07-03 | Multilingual | EN/ES/FR/DE/PT/HI/ZH at launch | — | P2 |
| F-07-04 | Speech-to-intent | Field commands: "log issue", "start capture", "find RFI" | Intent | P2 |

---

# 8. Plumb Live (multi-stakeholder walkthroughs)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-08-01 | Multi-user 360 room | Owner/GC/design/lender/insurance in same walkthrough | Presence | P4 |
| F-08-02 | Pass-the-pointer | Shared pointer + camera sync; voice/video/pin overlay | Presence | P4 |
| F-08-03 | Auto-minutes | Recorded → Transcribe → LLM summary | Minutes | P4 |
| F-08-04 | Realtime stack | Phoenix Channels + Redis Pub/Sub + WebRTC (IVS) | Presence, Stream | P4 |

---

# 9. Plumb Twin (digital twin)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-09-01 | Continuous delta detection | Every capture → diff vs prior state | DeltaDiff | P4 |
| F-09-02 | Handover package | Federated model + capture history + O&M + ESG export | Package | P4 |
| F-09-03 | FM integrations | Akila, Willow, AWS IoT TwinMaker, Azure Digital Twins | TwinLink | P4 |
| F-09-04 | Live state model | Queryable as-built state per element | ElementState | P4 |

---

# 10. Plumb ESG

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-10-01 | Embodied carbon tracking | BIM material quantities → CO2e | Carbon | P4 |
| F-10-02 | Waste tracking | Construction-phase waste streams | Waste | P4 |
| F-10-03 | Credit readiness | LEED / Envision / BREEAM checklists | Credit | P4 |
| F-10-04 | Disclosure reporting | GRESB / MSCI / SEC climate disclosure packs | Report | P4 |

---

# 11. Plumb Claims (legal-grade capture)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-11-01 | Chain-of-custody | RFC 3161 timestamps on every artifact | Signature | P4 |
| F-11-02 | Notarization | Notarized capture records | Notary | P4 |
| F-11-03 | Dispute-ready export | Single-PDF evidence pack; expert-witness template | Export | P4 |

---

# 12. Plumb Edge (on-device AI)

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-12-01 | Real-time scene understanding | On-device semantic segmentation (ANE/NNAPI) | Mask | P1 |
| F-12-02 | Local mesh stitching | On-device capture → mesh without server | Mesh | P2 |
| F-12-03 | Offline speech-to-intent | Intent parse without network | Intent | P2 |
| F-12-04 | PPE/safety detection | On-device PPE + fall-hazard detection; auto-flagged captures | Detection | P1 |

---

# 13. Plumb Admin & Trust

| ID | Function | Details | Data | Phase |
|---|---|---|---|---|
| F-13-01 | Org/portfolio dashboard | KPI tiles, activity stream, org switcher | Org | P1 |
| F-13-02 | RBAC + ABAC | Org roles × project roles; attribute-based policies; per-tenant isolation | Role, Policy | P1 |
| F-13-03 | Federated SSO + SCIM | OIDC + SAML + SCIM 2.0 provisioning | Identity | P2 |
| F-13-04 | Audit log | Append-only, hash-chained, WORM export; every state change | AuditLog | P1 |
| F-13-05 | Data residency | US/EU/UK/AU/JP/KSA pinning; region-pinned storage + inference | Region | P1 |
| F-13-06 | BYO-storage + CMK | Customer S3 + KMS keys; envelope encryption | Key, Storage | P3 |
| F-13-07 | Billing | Seat + storage + AI-minute metering; per-GB overage | Invoice | P2 |
| F-13-08 | Compliance evidence | SOC 2 / ISO 27001 / ISO 27701 / FedRAMP Moderate continuous collection | Evidence | P2+ |
| F-13-09 | MFA + adaptive risk | TOTP/FIDO2; step-up on sensitive ops | Session | P2 |
| F-13-10 | Share links | Signed, scoped, expiring tokens for read-only external views | ShareToken | P1 |

---

# Cross-cutting systems (not a product, but required)

| ID | System | Functions | Phase |
|---|---|---|---|
| X-01 | API surface | REST (public, Idempotency-Key + RFC 7807) · GraphQL (web BFF) · gRPC (internal) · WebSocket (realtime) · webhooks (partners, HMAC, replay) · OpenAPI 3.1 + Protobuf + SDL in CI | P1 |
| X-02 | Ingestion pipeline | Chunked resumable upload → virus scan → transcode → SfM → tile pyramid → segmentation → embedding → BIM alignment → publish (DAG w/ DLQ) | P1 |
| X-03 | Storage | S3 bucket layout: raw-360, derived-tiles, bim-tessellations, drone-geo, thumbnails, exports; lifecycle → Glacier; CRR only where residency allows | P1 |
| X-04 | Search | OpenSearch; per-tenant index aliases; hybrid BM25+dense | P2 |
| X-05 | Realtime | WebSocket topics per project; presence; soft-realtime SLA; SSE fallback | P1 |
| X-06 | Notifications | In-app + email + Slack/Teams + push (APNs/FCM); Live Activities | P1 |
| X-07 | Integrations (16) | Procore, ACC/BIM 360, P6, MS Project, Salesforce, ServiceNow, Slack, Teams, Box, GDrive, DocuSign, Smartsheet, Bluebeam, Aconex, Outlook, GCal | P2 (v1: Procore/ACC/P6) |
| X-08 | Billing | Metering → invoicing; usage dashboards | P2 |
| X-09 | Feature flags | Unleash/Flipt; progressive rollouts | P1 |
| X-10 | Mobile BFF / Web BFF | BFFs per surface; GraphQL for deep-link views | P1 |

---

# Core data model (18 entities)

Organization · User · Role · Project · Floorplan · Capture · CaptureFrame · Asset · BIMModel · FieldNote · Issue · IssueComment · Attachment · ProgressSnapshot · Integration · AuditLog · (Schedule) · (Citation)

Every entity carries `region` + `tenant_id` (data-modeled tenancy — a core architectural invariant).

---

# Release phasing summary

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 (done)** | Monorepo, tokens, org/project/user/membership services, auth, observability, dashboard shell, CI | 114 tests green, 3 commits |
| **P1 MVP** | Capture (360+smartphone+QuickCodes), Split View, Reveal, Coverage, Field (text/photo/voice), Voice EN, Edge v1 redaction, Project Hub, auth, ingest DAG | TTF capture < 5 min, 5 paid, NPS > 30 |
| **P2 Beta** | Field full (dictation/sketch/auto-floor), Issue board, Track v1, Model v1, Air v1, Voice multilingual, Integrations v1, Copilot v1 (chat+citations), SOC 2 prep | 50 paying projects, NPS > 45 |
| **P3 GA** | All core + Voice + Edge GA, Copilot voice, 3DGS rooms, AR overlay, FedRAMP Moderate, pricing live | GA launch |
| **P4 Scale** | Live, Twin, ESG, Claims, Drone-in-a-Box, on-prem/air-gapped, regional inference, CMMC/HIPAA | 5,000 projects, NPS > 60, NRR > 130% |

---

# Appendix: Performance & quality budgets the architect must design for

- Cost-per-capture ≤ **$15 fully-loaded** (compute $13 + storage $0.40 + LLM $0.85 + telemetry $0.25) at scale
- ≤ 30 GPU-min per 10K-frame capture; ≤ $0.50/capture amortized
- First-preview 360 ≤ 10 min; photoreal novel-view p50 ≤ 1.3 h, p95 ≤ 3 h
- p95 dashboard TTI < 1.5 s; 360 first-pixel < 800 ms; 60 fps M1 / 45 fps Intel Iris Xe
- ≥ 95% field capture success offline; 100% sync on reconnect
- SLOs: API p99 < 500 ms; availability 99.9%; capture ingest 99.5%
- Multi-tenant isolation tested across ALL data planes (search, vectors, caches, analytics, logs, exports)
