---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
releaseMode: phased
inputDocuments: []
workflowType: 'prd'
classification:
  projectType: saas_b2b
  domain: food_service_restaurant_tech
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - dine-in-cc

**Author:** Nic
**Date:** 2026-05-07

## Executive Summary

dine-in-cc is a multi-tenant SaaS platform that enables restaurant dine-in customers to self-order by scanning a QR code at their table, while giving restaurant owners a web-based Admin UI to manage menus and orders in real time. The product targets restaurants currently operating entirely on paper — no digital ordering tools, no POS integration — and replaces their manual order workflow with a lightweight, self-serve digital system. The primary job-to-be-done is reducing order errors during high-traffic service periods by eliminating the verbal handoff between customer, wait staff, and kitchen.

### What Makes This Special

dine-in-cc wins on two axes that incumbents (Toast, Square, and similar platforms) consistently fail on for this segment: **price** and **simplicity**. Existing tools are expensive, complex to onboard, and often require vendor involvement to set up a digital menu. dine-in-cc gives restaurant owners a self-serve menu builder — create items, configure prices and variants, attach images, set availability schedules, preview, and publish — without hiring a design agency or waiting on a vendor. The core insight is that the barrier to digital ordering adoption isn't awareness; it's cost and setup friction. A cheaper, simpler product that does the job is sufficient to unlock a large, currently underserved market of paper-based restaurants.

## Project Classification

- **Project Type:** B2B SaaS (multi-tenant)
- **Domain:** Food Service / Restaurant Technology
- **Complexity:** Medium — real-time order flow, multi-tenant data isolation, QR-based table sessions
- **Project Context:** Greenfield
- **Tech Stack:** Next.js · Supabase (PostgREST + Auth + RLS) · Cloudflare · Per-restaurant monthly billing · Single region

## Success Criteria

### User Success

- **Zero wrong-item complaints per service:** Orders submitted through the QR ordering flow reach the kitchen exactly as the customer entered them, with no transcription errors introduced by staff. Target: zero wrong-item complaints attributable to the ordering system during any single service period.
- **Self-serve onboarding:** A restaurant owner can create their menu, configure item availability, and go live without contacting support. Target: owner completes first publish in a single session.
- **Customer order completion without staff interaction:** Dine-in customers can browse the menu, configure items, and submit an order entirely through the QR flow with no staff involvement required.

### Business Success

- **Validation target (3 months):** 2 paying restaurants actively using the platform in production — defined as at least one full service week of real customer orders.
- **Retention signal:** Both restaurants continue using the platform after the first month with no churn.
- **Long-term:** Become the default operating standard for restaurants that have not yet adopted digital ordering tools.

### Technical Success

- **Order delivery reliability:** 99.9% of submitted orders reach the Admin UI within 5 seconds of customer submission.
- **Uptime:** Platform available during restaurant operating hours with no unplanned downtime during service periods.
- **Multi-tenant isolation:** Zero cross-tenant data leaks — each restaurant sees only its own menus, tables, and orders.
- **Mobile-web performance:** QR customer flow loads and is interactive in under 3 seconds on a mid-range mobile device over typical restaurant WiFi.

### Measurable Outcomes

| Outcome | Metric | Target |
|---|---|---|
| Order accuracy | Wrong-item complaints per service | 0 |
| Onboarding | Time from signup to first published menu | < 1 session |
| Reliability | Order delivery success rate | ≥ 99.9% |
| Validation | Active paying restaurants at 3 months | 2 |

## Product Scope

### MVP — Minimum Viable Product

Self-serve restaurant signup · menu builder (items, variants, images, availability schedules) · draft preview and publish · table management and QR code generation · customer QR ordering flow (mobile-web, anonymous) · real-time order delivery to Admin UI · basic order management · platform admin panel.

### Growth Features (Post-MVP)

- **Order status tracking:** Real-time order progress visible to customers after submission (confirmed → preparing → ready)
- **Kitchen Display Screen (KDS):** Kitchen-facing order queue with sequence and prep priorities
- **Payment integration:** In-app payment at order submission
- **Owner analytics:** Order volume, peak hours, popular items, revenue summaries
- **Multi-language menus:** Menu content in the customer's preferred language

### Vision (Future)

Become the operating standard for restaurants that have not yet adopted digital tools — the default platform a new restaurant reaches for to run their floor, replacing paper workflows end-to-end across ordering, kitchen management, and business reporting.

## User Journeys

### Journey 1: Marco — Restaurant Owner, First Week (Success Path)

Marco runs a 30-seat Italian trattoria. He's been managing orders on paper for eight years — waitstaff scribble orders, shout to the kitchen, and mix things up at least twice a night. He's not tech-averse, just never found something simple and cheap enough to bother with.

**Opening scene:** It's a Tuesday afternoon, quiet before service. Marco finds dine-in-cc through a Google search, signs up with his email, and lands in the Admin UI. No sales call, no waiting.

**Rising action:** He starts building his menu — adds "Spaghetti Carbonara," sets the price, uploads a photo from his phone, adds a variant ("without bacon"). He does this for 20 items over an hour. He configures availability: lunch specials available 11am–3pm only. He hits Preview — the menu looks exactly like what his customers will see. He hits Publish. He prints QR codes from the dashboard and tapes one to each table before the dinner service.

**Climax:** Friday night. Table 6 scans the QR code. Two orders appear in the Admin UI simultaneously — without any staff involvement. Marco glances at the screen from behind the counter. The orders are exact. No shouting, no scribbled notes, no "wait, did they say no onions or extra onions?"

**Resolution:** Marco gets through a full Friday service with zero wrong-item complaints. He texts a friend who owns a café down the street: "You need to try this thing."

*Capabilities revealed: self-serve signup, menu builder (items/variants/images/pricing), availability scheduling, QR generation, order display in Admin UI, real-time order delivery.*

---

### Journey 2: Marco — Busy Saturday Night (Edge Case)

Same restaurant, two weeks in. Saturday night. The kitchen is in the weeds — every table seated, orders coming in faster than the kitchen can clear them.

**Opening scene:** Three orders arrive simultaneously. The kitchen has a 20-minute backlog. Meanwhile, table 9 scans the QR code and submits another round of drinks and starters.

**Rising action:** Marco has no way to pause incoming orders from the QR system. He tells his one waiter to verbally let customers know the kitchen is backed up. Orders keep arriving through the system.

**Climax:** The kitchen eventually catches up. Two orders arrive slightly out of sequence. Marco manually reorders them on the screen. One customer asks where their starter is — it was received but deprioritised in the rush.

**Resolution:** The night is stressful, but every order that came through the system is accurate — no wrong items. Marco wishes he could pause QR ordering temporarily during a rush.

*Capabilities revealed: order management (manual resequencing), order receive timestamp display. Flags post-MVP need: order throttle / kitchen status control.*

---

### Journey 3: Aisha — Dine-in Customer (Success Path)

Aisha is out for lunch with a colleague. They sit at a table in Marco's trattoria. There's a QR code card in the centre of the table.

**Opening scene:** Aisha scans the QR code with her phone camera. No app to download. The menu opens instantly in her mobile browser.

**Rising action:** She browses categories, taps "Spaghetti Carbonara," sees the photo and description, selects "without bacon." She adds a sparkling water. She reviews her order and submits.

**Climax:** She taps "Place Order." A confirmation screen appears: "Your order has been received." No waiting for a server, no wondering if the request was heard correctly.

**Resolution:** Food arrives exactly as ordered. Aisha doesn't think about the technology at all — it just worked.

*Capabilities revealed: mobile-web QR flow (no app install), menu browsing by category, item detail (photo/description/variants), order configuration, order submission, confirmation screen, anonymous session (no account required).*

> **MVP decision:** Each customer submits their own individual order per session. Shared/combined table orders are post-MVP.

---

### Journey 4: Nic — Platform Admin, Supporting a New Restaurant (Operations)

A new restaurant owner, David, signs up but gets stuck — he can't find how to generate QR codes after publishing his menu.

**Opening scene:** Nic receives a support message from David. Nic logs into the platform admin panel.

**Rising action:** Nic looks up David's tenant account, confirms the menu is published and tables are configured. The QR codes are ready — David simply hadn't found the "Print QR codes" section in the dashboard.

**Climax:** Nic sends David a direct link with instructions. David prints and goes live that afternoon.

**Resolution:** David completes his first service. Nic notes that two other new restaurants had the same confusion — QR code generation needs to be more prominent in the onboarding flow.

*Capabilities revealed: platform admin panel (tenant list, account lookup), tenant account inspection, support workflow, product insight loop from support.*

---

### Journey Requirements Summary

| Journey | Key Capabilities |
|---|---|
| Marco — Setup | Self-serve signup, menu builder, availability scheduling, QR generation, Admin UI order display |
| Marco — Rush night | Real-time order list, manual resequencing, order timestamps; flags post-MVP kitchen throttle |
| Aisha — Customer | Mobile-web QR flow, menu browsing, item config, order submission, confirmation, anonymous auth |
| Nic — Platform admin | Tenant management panel, account inspection, support workflow |

## Domain-Specific Requirements

Domain regulatory burden is low. No HIPAA, PCI-DSS (payments are post-MVP), or industry-specific certifications required for MVP.

### Privacy

- Dine-in customers are fully anonymous — no PII collected, no account created, no contact information requested at any point in the order flow.
- Anonymous Supabase session tokens are scoped to `restaurant_id` + `table_id` and expire after the dining session.

### Pricing & Tax Display

- Menu prices are **tax-inclusive** — the price entered by the owner is the price shown to the customer. No tax calculation logic required in MVP.

### Data Retention

- Order history retained for **6 months** per tenant, then purged automatically.

## B2B SaaS Specific Requirements

### Tenant Model

- **Tenant unit:** One restaurant = one tenant
- **Isolation mechanism:** Supabase Row Level Security (RLS) — all queries scoped by `restaurant_id` in the authenticated JWT; cross-tenant access blocked at the database layer
- **Tenant provisioning:** Self-serve — owner signs up, creates their restaurant profile, and becomes the first admin user of that tenant
- **Tenant data:** Menu items, categories, tables, QR codes, orders — all scoped to tenant; no shared data between tenants

### Permission Model (RBAC)

| Role | Description | Access |
|---|---|---|
| Platform Admin | Nic (operator) | Full tenant list, account inspection, billing management |
| Restaurant Owner | Signed-up restaurant operator | Full Admin UI: menu management, order view, table/QR management, settings |
| Restaurant Staff | (Post-MVP) Additional staff accounts | Order view only |
| Dine-in Customer | Anonymous, no account | Public menu browsing + order submission for their table session only |

> **MVP:** Only Restaurant Owner role is implemented. Staff sub-accounts are post-MVP.

### Subscription Model

- Single tier, flat monthly billing — one price per restaurant per month
- No usage-based metering, no per-seat pricing, no feature gating in MVP
- Billing managed externally (TBD: Stripe or manual invoicing for first 2 restaurants)

### Integrations (MVP)

- **Supabase Auth** — restaurant owner authentication and anonymous customer session tokens
- **Supabase PostgREST** — all data operations via REST API with RLS enforcement
- **Cloudflare** — static asset hosting and edge function routing
- No POS integrations, email providers, or third-party webhooks in MVP

### Implementation Considerations

- **Anonymous customer sessions:** Supabase anonymous auth issues a short-lived JWT scoped to `restaurant_id` + `table_id` on QR scan; session expires after dining session inactivity timeout (TBD duration)
- **QR code generation:** Each table gets a unique, stable QR code URL encoding `restaurant_id` + `table_id`; codes generated server-side and available for download/print from Admin UI
- **Real-time order delivery:** Supabase Realtime subscriptions deliver orders to Admin UI; fallback to short-interval polling (3–5 seconds) if Realtime is unavailable

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — the minimum surface that proves order accuracy improves without staff involvement. Success is a restaurant running a full service with zero wrong-item complaints.

**Resource Requirements:** Solo developer. Scope is a hard boundary — any addition requires explicit removal of something else.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Marco (owner) — self-serve signup, menu build, and publish
- Aisha (customer) — QR scan → browse → order → confirmation
- Marco (owner) — real-time order receipt in Admin UI during service

**Must-Have Capabilities:**
- Self-serve restaurant signup and onboarding
- Menu builder: create/edit/delete items with price, variants, image, availability schedule
- Menu draft preview and publish
- Table management and QR code generation (per-table unique URL)
- Customer QR ordering flow: mobile-web, anonymous, no app install
- Real-time order delivery to Admin UI via Supabase Realtime
- Multi-tenant data isolation via Supabase RLS
- Basic order management: view incoming orders, mark as handled
- Platform admin panel: tenant list and account inspection

### Post-MVP Features

**Phase 2 — Growth (after validation with first 2 restaurants):**
- Order status tracking for customers (confirmed → preparing → ready)
- Kitchen Display Screen (KDS)
- Staff sub-accounts with order-view-only role
- Payment integration
- Owner analytics
- Multi-language menus

**Phase 3 — Vision:**
- Full floor management, reporting, and business intelligence
- POS and third-party integrations

### Risk Mitigation Strategy

**Technical Risks:**
- *Supabase Realtime for order delivery* — highest-risk MVP dependency; validate with a spike before building the full order flow. Fallback: short-interval polling (3–5 seconds) achieves the 5-second delivery target without WebSocket complexity.
- *RLS policy correctness* — a cross-tenant data leak is a P0 failure; write integration tests that explicitly verify tenant isolation before any production data exists.

**Market Risks:**
- *First restaurants already identified* — validation risk is low. Primary risk is real-service adoption: mitigated by hands-on support for both restaurants during their first service week.

**Resource Risks:**
- *Solo developer* — treat the MVP feature list as a hard boundary. Growth features do not move into MVP without an explicit trade-off decision.

## Functional Requirements

### Restaurant Onboarding & Account Management

- **FR1:** Restaurant owner can create a new account via self-serve signup
- **FR2:** Restaurant owner can create a restaurant profile (name, basic details) as part of onboarding
- **FR3:** Restaurant owner can log in and log out of the Admin UI
- **FR4:** Restaurant owner can reset their password

### Menu Management

- **FR5:** Restaurant owner can create a menu item with a name, description, tax-inclusive price, and image
- **FR6:** Restaurant owner can define variants for a menu item (e.g., size, modifications, add-ons)
- **FR7:** Restaurant owner can set a price for each variant
- **FR8:** Restaurant owner can configure an availability schedule for a menu item (days and time windows)
- **FR9:** Restaurant owner can organize menu items into named categories
- **FR10:** Restaurant owner can edit any existing menu item's details
- **FR11:** Restaurant owner can delete a menu item
- **FR12:** Restaurant owner can reorder items within a category
- **FR13:** Restaurant owner can preview the menu exactly as customers will see it before publishing
- **FR14:** Restaurant owner can publish a draft menu to make it live for customer ordering
- **FR15:** Restaurant owner can take the menu offline

### Table & QR Management

- **FR16:** Restaurant owner can create a table with a name or number
- **FR17:** System generates a unique QR code URL for each table encoding restaurant and table identity
- **FR18:** Restaurant owner can download or print QR codes for physical table placement
- **FR19:** Restaurant owner can delete a table and invalidate its QR code

### Customer Ordering

- **FR20:** Customer can access a restaurant's live menu by scanning a table QR code without installing an app
- **FR21:** Customer can browse menu items organized by category
- **FR22:** System displays only items within their configured availability schedule at the time of ordering
- **FR23:** Customer can view item details including name, description, price, image, and available variants
- **FR24:** Customer can configure an order item by selecting variants
- **FR25:** Customer can add multiple items to a single order
- **FR26:** Customer can review their full order summary before submitting
- **FR27:** Customer can submit an order without creating an account or providing any personal information
- **FR28:** Customer receives an on-screen order confirmation after successful submission
- **FR29:** Customer can only view and order from the menu of the restaurant linked to their scanned QR code

### Order Management

- **FR30:** Restaurant owner can view all incoming orders in the Admin UI
- **FR31:** Admin UI displays each order's items, variants, table number, and submission timestamp
- **FR32:** Restaurant owner can mark an order as handled
- **FR33:** Restaurant owner can view order history within the current service period

### Real-Time Order Delivery

- **FR34:** System delivers a submitted order to the Admin UI within 5 seconds of customer submission
- **FR35:** Admin UI updates automatically when a new order arrives without requiring a page refresh

### Multi-Tenancy & Access Control

- **FR36:** Each restaurant's menu, tables, and orders are fully isolated from all other restaurants
- **FR37:** Restaurant owner can only access data belonging to their own restaurant
- **FR38:** Customer ordering session is scoped to the restaurant and table from the scanned QR code
- **FR39:** System issues an anonymous session token to customers on QR scan that expires after the dining session

### Platform Administration

- **FR40:** Platform admin can view a list of all registered restaurant tenants
- **FR41:** Platform admin can inspect the account and configuration details of any tenant
- **FR42:** Platform admin can access any tenant's data for support purposes

## Non-Functional Requirements

### Performance

- **NFR1:** Customer QR ordering flow (menu load to order-ready state) completes in under 3 seconds on a mid-range mobile device over typical restaurant WiFi
- **NFR2:** Submitted customer orders appear in the Admin UI within 5 seconds of submission under normal operating conditions
- **NFR3:** Admin UI actions (marking order handled, navigating menu sections) respond within 1 second
- **NFR4:** Menu publish operation completes within 3 seconds regardless of menu size

### Security

- **NFR5:** All data in transit is encrypted via HTTPS/TLS — no unencrypted API calls permitted
- **NFR6:** Customer anonymous session tokens are scoped exclusively to the issuing restaurant and table — tokens from one restaurant cannot access another restaurant's data
- **NFR7:** Restaurant owner authentication tokens are invalidated on logout
- **NFR8:** The platform admin role is accessible only to explicitly designated accounts — no privilege escalation path exists for restaurant owner accounts
- **NFR9:** No personally identifiable information is stored or logged for dine-in customers at any point in the order flow
- **NFR10:** All database queries are enforced by Row Level Security policies — application-level access control alone is not sufficient

### Reliability

- **NFR11:** The platform maintains availability during restaurant operating hours — unplanned downtime during an active service period is a P0 incident
- **NFR12:** Order data is persisted durably — a submitted order is not lost due to network interruption or client-side failure after server acknowledgement
- **NFR13:** The customer ordering flow degrades gracefully if Supabase Realtime is unavailable — order submission succeeds even if real-time Admin UI updates temporarily fall back to polling

### Accessibility

- **NFR14:** The customer QR ordering flow meets WCAG 2.1 AA standards — usable by customers with visual, motor, or cognitive impairments on any mobile browser
- **NFR15:** The Admin UI meets WCAG 2.1 AA standards as a baseline

### Scalability

- **NFR16:** The system supports at least 50 concurrent customer ordering sessions per restaurant without degradation — sufficient for a fully-seated restaurant during peak service
- **NFR17:** The multi-tenant data model supports onboarding new restaurants without schema changes or manual intervention
- **NFR18:** Order history is automatically purged after 6 months per tenant — storage growth is bounded without manual maintenance
