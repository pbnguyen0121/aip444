# Legitimacy Check

## Purpose

This evaluation checks whether the Phase 3 legitimacy agent can distinguish between a real legitimate job posting and a deliberately suspicious synthetic posting.

The evaluation compares the system's legitimacy signals and final verdict with my own manual assessment.

---

## Case 1: Google — Software Developer, Early Career, Campus

### Manual Assessment

**Expected verdict: GREEN / Legitimate**

I consider this posting legitimate because Google is a well-established company with a large public presence, an official careers website, established company domains, and publicly verifiable employment information.

The posting contains specific role requirements, compensation information, locations, responsibilities, and technical qualifications. It does not request payment, banking information, government identification, or other sensitive personal information during the initial application stage.

### Advisor Result

- Verdict: **GREEN**
- Confidence: **100%**
- WHOIS/RDAP domain: `about.google`
- RDAP lookup: Successful
- Registration date: August 6, 2018
- Registrar: MarkMonitor Inc.
- Red flags identified: None

### Important Green Flags Identified

- Established company presence
- Detailed and consistent job description
- Market-consistent compensation
- Public employee and company information
- Valid RDAP/domain information
- No payment or unusual sensitive-information requests

### Do I Agree?

Yes.

The GREEN verdict matches my manual assessment. The system used both web-search evidence and domain-registration information and did not identify suspicious application requirements.

---

## Case 2: NorthStar Digital Solutions — Synthetic Suspicious Posting

### Manual Assessment

**Expected verdict: RED / Highly suspicious**

This posting was deliberately created as a synthetic suspicious job posting for evaluation.

The posting contains several major recruitment-scam signals:

- Requests a Social Insurance Number before employment
- Requests banking information during the initial hiring process
- Requests a passport or driver's licence
- Requires a $750 equipment payment
- Requires a $250 training deposit
- Uses a generic Gmail address instead of a company email domain
- Uses urgency language such as "Immediate hiring" and "Limited positions available"
- Advertises unusually high compensation for a junior role requiring no professional experience
- Uses a synthetic and unverified company website/domain

Based on these signals, I would not provide any personal information or money and would not continue with the application without independent verification.

### Advisor Result

- Verdict: **RED**
- Confidence: **100%**
- Explicit posting domain: `northstar-digital-careers-example.com`
- Identity verified: **No**
- WHOIS/RDAP lookup: Domain not found
- Recruiter email domain: `gmail.com`

### High-Priority Signals Identified by the Advisor

The advisor directly detected several suspicious signals from the posting text:

- Sensitive PII requested before employment
- Banking information requested upfront
- Government identification requested upfront
- Generic recruiter email domain

The system also preserved the explicit domain from the posting instead of replacing it with a domain belonging to a similarly named company.

The RDAP lookup for `northstar-digital-careers-example.com` returned no registration information, which added additional uncertainty about the company's identity.

The generated legitimacy warning also identified:

- Requests for Social Insurance Number information
- Banking information
- Government-issued identification
- Unusually high compensation for a junior/no-experience role
- Generic Gmail contact information
- An unverified/non-functional company domain

### Do I Agree?

Yes.

The final RED verdict matches my manual assessment.

The strongest part of the final system was that it did not depend only on web-search results to determine legitimacy. It also inspected the job posting itself for sensitive-information and payment-related scam signals.

This was important because searches for "NorthStar Digital Solutions" returned information about similarly named organizations. Earlier testing showed that this could cause company-identity contamination.

After the system was updated to prioritize explicit posting evidence and the posting's own domain, it correctly treated the company identity as unverified and produced a RED verdict.

---

## Fit vs. Legitimacy Observation

An interesting result from the synthetic posting was that the Application Advisor gave the candidate a high technical fit score of approximately **85/100**, while the legitimacy assessment was **RED**.

This is not a contradiction.

The fake posting was intentionally written with programming requirements that closely matched the resume, including JavaScript, Python, C++, databases, testing, and general junior software-development responsibilities.

This demonstrates why job fit and job legitimacy must be evaluated separately.

A candidate may match the technical requirements of a posting very well while the posting itself is unsafe or fraudulent.

For this reason, placing the Legitimacy Assessment before the Fit Assessment in the final HTML report is useful.

---

## Overall Legitimacy Evaluation

The final legitimacy system successfully distinguished between the legitimate Google posting and the deliberately suspicious synthetic posting.

| Posting | Expected | Advisor Verdict | Correct? |
|---|---|---|---|
| Google — Early Career Software Developer | GREEN | GREEN, 100% confidence | ✅ |
| NorthStar Digital Solutions — Synthetic Posting | RED | RED, 100% confidence | ✅ |

The Google posting produced strong green signals including established company presence, valid domain information, and consistent compensation and job details.

The synthetic posting produced strong red signals including sensitive PII requests, banking information, government identification, generic Gmail contact information, an unverified domain, and suspicious hiring requirements.

The evaluation also exposed weaknesses during development. Earlier versions of the legitimacy agent could fail on malformed LLM JSON or associate search results from similarly named companies with the posting. These issues were corrected by adding safer JSON recovery, prioritizing explicit posting domains, detecting scam signals directly from posting text, and treating unresolved company identity as uncertainty rather than guessing.

After these fixes, I consider the legitimacy component reasonably reliable for identifying obvious scam signals. However, a human should still independently verify the official company careers page, recruiter email domain, and any request for sensitive personal or financial information before applying.