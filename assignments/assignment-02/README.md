# AIP444 Assignment 2 — Job Market Intelligence & Application Advisor

## Overview

This project is a command-line Job Market Intelligence and Application Advisor built for AIP444 Assignment 2.

The system processes job-posting PDFs, extracts structured information using an LLM, researches companies, analyzes job-market trends, compares the market with a resume, and generates an application report for a new job posting.

The project is divided into three main phases:

1. Job Posting Extraction and Company Research
2. Market and Resume Gap Analysis
3. Application Advisor

---

## Requirements

- Node.js
- npm
- OpenRouter API key
- Tavily API key

The project uses environment variables from the AIP444 `.env` file.

Example configuration:

```env
OPENROUTER_API_KEY=your_openrouter_key
LLM_MODEL=your_openrouter_model
TAVILY_API_KEY=your_tavily_key
```

API keys must not be committed to the repository.

---

# Phase 1 — Job Posting Intelligence

Phase 1 reads job-posting PDFs and converts them into structured JSON.

The extracted information includes:

- Job title
- Company
- Location
- Remote status
- Required skills
- Preferred skills
- Experience level
- Education requirements
- Salary
- Responsibilities
- Company research

The company-research step uses Tavily to collect additional public information about the employer.

Processed job data is stored under:

```text
data/jobs/
```

The project was tested with nine job postings.

---

# Phase 2 — Market and Resume Analysis

Phase 2 combines the structured job data to identify patterns in the job market.

Run the market analysis with:

```bash
npm run analyze:market
```

The generated market analysis contains:

- Common required skills
- Skill frequency
- Market trends
- Technology demand
- General observations across the collected postings

The market analysis is stored in:

```text
data/market-analysis.json
```

The resume is also converted into structured data and compared with the job-market analysis.

Run the gap analysis with:

```bash
npm run gaps
```

The gap analysis identifies:

- Existing strengths
- Missing or weaker skills
- Short-term learning opportunities
- Medium-term learning opportunities
- Unique candidate value

The generated gap analysis is stored under:

```text
data/analysis/gap-analysis.json
```

---

# Phase 3 — Application Advisor

Phase 3 accepts a new job-posting PDF and generates an application report.

Run:

```bash
npm run advise -- <pdf-path>
```

Example:

```bash
npm run advise -- input/advisor/google-job.pdf
```

For detailed debugging information:

```bash
npm run advise -- input/advisor/google-job.pdf --verbose
```

The advisor uses the Phase 1 and Phase 2 artifacts together with the new job posting.

The final report contains five sections:

1. Legitimacy Assessment
2. Fit Assessment
3. Resume Adaptation
4. Cover Letter Guidance
5. Interview Preparation

The generated report is saved to:

```text
reports/application-report.html
```

The report is a self-contained HTML file and can be opened directly in a browser.

---

## Legitimacy Assessment

The legitimacy investigation uses web research and WHOIS/RDAP information together with evidence directly found in the job posting.

The legitimacy investigation has a hard limit of:

- Maximum 5 Tavily searches
- Maximum 1 WHOIS/RDAP lookup

This limit applies specifically to the legitimacy investigation. Earlier company research may perform its own bounded searches.

The system looks for signals such as:

- Official company presence
- Domain information
- Recruiter email domain
- Requests for sensitive personal information
- Banking information requests
- Government identification requests
- Applicant payments or deposits
- Suspicious urgency language
- Company identity inconsistencies

The final verdict is one of:

- GREEN
- YELLOW
- RED

---

## Fit Assessment

The advisor compares the posting with the structured resume and previous market/gap analysis.

The intended score interpretation is:

| Score    | Interpretation                           |
| -------- | ---------------------------------------- |
| 80–100   | Strong fit                               |
| 50–79    | Good fit — applying should be encouraged |
| 30–49    | Stretch, but may still be worth applying |
| Below 30 | Major growth target                      |

The report explains the score using evidence from both the posting and resume.

---

## Resume Adaptation

The report suggests how existing resume evidence can be positioned for the target posting.

The system is designed to use evidence already present in the resume rather than inventing qualifications.

---

## Cover Letter Guidance

The advisor generates job-specific cover-letter guidance, including:

- Main points to emphasize
- Relevant projects or skills
- Company/job-specific topics
- Important gaps that should not be misrepresented

---

## Interview Preparation

The final section provides:

- Likely interview questions
- Skills to review
- Company or role topics to research
- Talking points based on existing resume evidence

---

# Testing

TypeScript validation:

```bash
npm run typecheck
```

Schema tests:

```bash
npm run test:schema
```

Advisor utility/regression tests:

```bash
npm run test:advisor
```

Additional test scripts were used during development for PDF extraction, job extraction, processing, and other individual pipeline stages.

---

# Evaluation

Evaluation files are stored under:

```text
eval/
```

The evaluation includes:

```text
eval/extraction-spot-check.md
eval/scoring-check.md
eval/legitimacy-check.md
eval/failure-analysis.md
```

The evaluation tests:

- Structured extraction accuracy
- Fit scoring across different job-fit levels
- Scoring consistency across repeated runs
- Legitimate versus suspicious postings
- Real failure cases found during development

A deliberately synthetic suspicious posting was also used to test the legitimacy system.

---

# Known Limitations

The evaluation identified several limitations.

LLM extraction can occasionally summarize an important requirement instead of preserving the exact value. It can also infer unsupported information such as a salary currency.

Fit scores can be reasonable while the generated recommendation wording is inconsistent with the intended score category. A future improvement would be to derive the recommendation category deterministically from the numeric score.

Free LLM models can occasionally return malformed structured responses. The project includes recovery and validation logic, but ambiguous responses still fall back safely.

Company research can also be difficult when multiple organizations have similar names. Explicit posting domains are prioritized, but company-specific secondary research should still be treated cautiously when identity cannot be independently verified.

---

# Cost and Model Usage

The project was developed with a preference for free OpenRouter models where possible.

Free models can experience:

- Rate limits
- Provider availability changes
- Structured-output inconsistencies

The system includes retry and validation behavior to handle these problems.

Model usage information is recorded during processing so API usage can be reviewed during development and evaluation.

---

# Security

API keys are stored in environment variables and must not be committed to Git.

Job postings should also be treated as untrusted input. Information found in a posting or through web research should not automatically be considered trustworthy.

The legitimacy assessment is decision support only. Users should independently verify employers and should never send money or sensitive personal information based only on the advisor's output.
