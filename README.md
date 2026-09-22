# CareRelay

**Offline-first coordination of complete care journeys for rural public healthcare.**
Smart India Hackathon 2026 · Problem ID SIH26133 · Theme: MedTech / BioTech / HealthTech

> Don't just book the patient — make sure the journey is ready.

A rural patient can travel 26 km to a confirmed appointment and still be turned away because a reagent ran out, the technician is off duty, or the equipment is down. CareRelay is a coordination layer over existing government facilities that answers one question before the patient leaves home: **can this patient actually complete the required next stage of care with this journey?**

## Run it

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`. Start with **Guided Demo** in the sidebar for the full ten-step diabetes journey.

## The four differentiators (implemented, not just described)

1. **Expiry-aware readiness** — every doctor, lab, technician, equipment, reagent and medicine claim carries who verified it, when, and a validity window. Status is computed from the clock: `Confirmed · Last Known · Pending · Expired · Unavailable`. Only *Confirmed* counts as ready, so a stale tick degrades automatically instead of misleading someone.
2. **Travel-Ready Care Bundle** — clinically sequenced: appointment → doctor → sample → lab + technician + reagents → result → medicines, plus instructions, a named coordinator, transport and a fallback plan.
3. **Pre-travel revalidation** — everything is re-checked before the patient travels. On failure the system names the failed component, notifies its owner, tells the patient to wait, and offers the fallback.
4. **Accountable referral closure** — `Requested → Accepted → Scheduled → Attended → Reviewed → Followed-up`, each stage with an owner, a deadline and an escalation path. Sending a referral is not completing one.

Plus an **emergency override**: critical patients never wait for internet, ABHA ID, an appointment or a complete bundle.

## Screens

Login / role selection · ASHA dashboard · patient registration · patient profile and vitals · rule-based triage · referral creation · hospital referral inbox · facility readiness · Travel-Ready Care Bundle · pre-travel revalidation · doctor dashboard · lab and pharmacy · patient care card · follow-up dashboard · district administrator dashboard · offline queue · audit log.

Roles: ASHA/ANM, PHC & rural hospital staff, doctor/clinician, lab & pharmacy staff, district administrator, patient.

## Offline-first behaviour

Registration, vitals, triage, referral creation and follow-up completion all work with no network, stored with device timestamps and a visible sync queue with a **Sync Now** action. Server-owned facts (appointment slots, stock levels, readiness claims) are never fabricated offline — they display as *Last Known* with their age, or *Pending*.

## Patient access

Smartphone optional. A printable care card carries the appointment, transport, coordinator and three instructions in **English, Marathi or Hindi**, with audio playback. The card and any SMS carry a reference code only — no diagnosis, no lab values.

## Interoperability

Data is shaped for ABDM / FHIR R4 alignment: `Patient`, `Encounter`, `Observation`, `ServiceRequest`, `Appointment`, `DiagnosticReport`, `MedicationRequest`. Readiness claims have no FHIR equivalent and are modelled as a custom extension. **No live ABDM or eSanjeevani connection exists in this prototype.**

## Scope honesty

| | |
|---|---|
| **DEMO DATA** | Every patient, facility, reading and stock figure is fictional. |
| **PROTOTYPE FUNCTIONALITY** | Offline capture, rule-based triage, readiness expiry evaluation, bundle validation, pre-travel revalidation, referral state machine with owners and SLAs, follow-up closure, audit log, multilingual printable care card, district metrics. |
| **PRODUCTION INTEGRATION (not built)** | ABDM/ABHA gateway, eSanjeevani, HMIS / e-Aushadhi stock feeds, SMS/IVR gateway, state health authority approval. |

No AI/ML. No blockchain. No claims of patentability, real government integration, real patient outcomes or invented percentages. The role picker is a demo selector, not authentication — server-side identity and authorization are part of the production design, not this prototype.

## Files

```
index.html    shell and asset loading
styles.css    design tokens and layout
data.js       seeded demo data
logic.js      readiness expiry, referral state machine, bundle, sync, triage rules
app.js        router and all screens
```

Demo state is held in memory, so a reload restores the seeded starting point — convenient for repeated demonstrations.
