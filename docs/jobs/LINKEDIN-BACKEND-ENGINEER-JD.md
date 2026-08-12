---
hide: navigation
---

## About the job

**Senior Backend Engineer**

**Location:** Remote (US/EU time zones)

**Employment Type:** Full-Time

**Compensation:** $160k–$200k base + 0.5%–1.0% equity

We're looking for a senior backend engineer to be the first backend hire at a well-capitalized, early-stage startup. You will own the entire backend — services, data plane, integrations, and infrastructure — and pair with our existing frontend engineer on a 6-month roadmap that has already been defined. If you can ship a production-grade multi-tenant SaaS end-to-end, write strict TypeScript without flinching, and enforce tenant isolation at every data plane (not just the API), we'd love to hear from you.

---

### Key Responsibilities

- Design, build, test, deploy, and operate the backend services that power the platform.
- Own the data model: design PostgreSQL schemas, write the parameterized SQL, enforce row-level security, and manage migrations.
- Build and maintain REST APIs with idempotency, RFC 7807 error responses, and structured request-id-propagated logging.
- Implement authentication and authorization: OIDC, SAML SSO, SCIM, MFA, RBAC + ABAC, and share-link tokens.
- Build reliable ingestion pipelines: chunked-resumable uploads, virus scanning, transcoding, async DAG workflows with backpressure and DLQ.
- Build and maintain 3rd-party integrations (priority set, OAuth + webhooks + replay).
- Operate on AWS (EKS, S3, RDS, Lambda, Step Functions, EventBridge, KMS, CloudWatch) using IaC.
- Mentor the frontend engineer on backend topics during paired sessions.
- Participate in on-call rotation (every other week) once services are in production.

---

### Required Qualifications

- 6+ years of professional software development experience, with a focus on backend systems.
- Bachelor's degree in Computer Science, Computer Engineering, or a related field (or equivalent practical experience).
- Deep proficiency in TypeScript and Node.js in production. You have shipped at least one REST API that handles > 10k RPS or > 1 TB/month of uploads.
- Deep PostgreSQL fluency: window functions, query plans, locking, RLS, partitioning, and parameterized SQL.
- Strong AWS experience: you've deployed services on EC2/EKS, used S3 directly (not just `aws-sdk`), written IAM policies from scratch, and debugged CloudWatch logs.
- Experience with strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, or equivalent). You treat `as` as a last resort.
- Production experience with multi-tenant systems. You have enforced tenant isolation at every data plane — API, database, cache, search, object storage, and event bus — not just the API.
- Strong knowledge of SQL, relational databases, and data modeling.
- Experience with Git, CI/CD, and DevOps practices.
- Experience developing applications in Linux environments.

---

### Preferred Skills

- Construction, geospatial, or 3D / 360° / point-cloud product experience.
- Experience with Fastify, Express, or comparable Node.js web frameworks.
- Experience with Kinesis, SQS, EventBridge, or Kafka in production.
- Experience with Step Functions, Airflow, or other workflow orchestrators.
- Experience with public APIs, partner-tier SLAs, and webhook delivery with HMAC + replay.
- Experience with Elixir / Phoenix Channels, or willingness to learn.
- AWS (EC2, S3, RDS, EKS, Lambda) or other cloud platforms.
- Frontend development with React, Next.js, HTML, and CSS — enough to pair with the frontend engineer.
- Docker, Kubernetes, Terraform, and Bash scripting.
- Knowledge of application performance optimization and scalable software design.
- Experience with TDD discipline and strict test coverage requirements.

---

### What success looks like in 90 days

- 200+ tests passing across the workspace.
- Postgres parity for all backend services; production-readiness score ≥ 80%.
- A real OIDC provider fully integrated.
- The capture ingestion pipeline shipped end-to-end (upload → processing → ready → realtime push).
- 1 third-party integration in production (round-trip CRUD).
- Zero Sev1 incidents; Sev2 MTTR < 4 h.

---

### Hiring process

1. Phone screen (30 min).
2. Paid take-home (3 hours, $300) — implement a small backend service against a spec. Graded on test coverage, error handling, idempotency, and observability.
3. System design (90 min) — design a chunked-resumable upload service in conversation.
4. Pair programming (90 min) — a real codebase task with the Tech Lead.
5. Founder chat (45 min).
6. Offer within 48 hours of the final round.

We aim to close in 2 weeks from first contact. No panel of 6 people. No whiteboard algorithms.

---

### How to apply

Email `engineering@sthyra-crm.dev` with:

- A 200-word cover note answering: **"What's the most subtle tenant-isolation bug you've debugged, and what did you learn?"**
- Your GitHub or GitLab.
- A specific project you shipped where you were the only backend engineer.

No recruiters. No agencies. No LinkedIn Easy Apply.

---

*Sthyra CRM is an equal-opportunity employer. We hire on the basis of merit and potential. We do not discriminate on race, color, religion, gender, gender identity, sexual orientation, national origin, age, disability, veteran status, or any other characteristic protected by law.*
