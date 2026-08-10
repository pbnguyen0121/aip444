# Extraction Spot Check

## Purpose

This evaluation checks whether the structured job extraction matches information that is actually present in the original PDF job postings.

The expected values below were recorded manually before running the batch extractor on these postings.

---

## Posting 1: Developer — New Market Group (NMG)

PDF: `Developer.pdf`

| Field | Expected | Extracted | Correct? |
|---|---|---|---|
| Job title | Developer | Developer | ✅ |
| Company | New Market Group (NMG) | New Market Group (NMG) | ✅ |
| Location | 200 Davis Drive, Newmarket, ON L3Y 2N4 | 200 Davis Drive, Newmarket, ON L3Y 2N4 | ✅ |
| Remote status | In person; remote work is not available | In Person | ✅ |
| Posting age/date | Not listed | null | ✅ |
| Required skills | .NET, SQL, SQL Server, Software Analysis, Software Design, Client-Server Development, Desktop Application Development | .NET, SQL, SQL Server, Software Analysis, Software Design, Client-Server Development, Desktop Application Development | ✅ |
| Preferred skills | Communication, analytical skills, problem-solving, creativity, self-motivation, time management, project management, collaboration | Bachelor's Degree, English | ⚠️ Partial |
| Experience | 10 years of Developer experience required; role described as Intermediate Developer | Intermediate Developer | ❌ Missed 10-year requirement |
| Education | University or College education relevant to the position; Bachelor's Degree preferred | University or College education; Bachelor's Degree | ✅ |
| Salary | $110,000–$130,000 per year | 110000–130000, currency = USD | ⚠️ Range correct, currency unsupported |
| Key responsibilities | .NET development, SQL Server development, client-server and desktop applications, requirements analysis, software design, collaboration and project/task management | Correctly extracted these responsibilities and several additional responsibilities from the posting | ✅ |

### Observations

The extractor performed very well on the basic structured fields for this posting. It correctly identified the job title, company, location, in-person work arrangement, technical skills, education requirements, salary values, and major responsibilities.

Two weaknesses were found. First, the posting explicitly requires 10 years of Developer experience, but the extractor simplified the experience field to only "Intermediate Developer." This loses an important requirement that would affect fit scoring later.

Second, the salary values were extracted correctly, but the model assigned the currency as USD even though the posting itself did not explicitly state USD. Because the job is located in Ontario, it may be tempting to infer CAD, but the extractor should not infer any currency that is not explicitly stated.

The preferred-skills field was also imperfect. It extracted Bachelor's Degree and English, which are listed as preferred requirements, but it did not capture several professional qualities such as communication, analytical ability, problem-solving, collaboration, and time management.

---

## Posting 2: Software Engineer – Intern/Co-op — Viggle AI

PDF: `Software Engineer.pdf`

| Field | Expected | Extracted | Correct? |
|---|---|---|---|
| Job title | Software Engineer – Intern/Co-op | Software Engineer – Intern/Co-op | ✅ |
| Company | Viggle AI | Viggle AI | ✅ |
| Location | Toronto, Ontario | Toronto, Ontario | ✅ |
| Remote status | Not listed | null | ✅ |
| Posting age/date | Not listed | 0 days | ❌ |
| Required skills | Strong software engineering fundamentals, ability to learn quickly, engineering judgment, problem-solving, adaptability, interest in real products and emerging technologies | Strong software engineering fundamentals, ability to learn quickly, engineering judgment, problem-solving, adaptability, interest in real products and emerging technologies, production-level work, ownership | ✅ |
| Preferred skills / technologies mentioned | React, React Native, Next.js, TypeScript, Node.js, Go, Python, Rust, Three.js, WebGL, Unity, Unreal Engine, PyTorch, CUDA, Ray, Computer Vision, MLOps, API design, distributed systems and related technologies | React, React Native, Next.js, TypeScript, Node.js, Go, Python, Rust, API design, Distributed systems, Three.js, WebGL, Unity, Unreal Engine, PyTorch, CUDA, Ray, Computer Vision, MLOps and related technologies | ✅ |
| Experience | Internship/Co-op; no number of years listed | Intern/Co-op | ✅ |
| Education | Not listed | Empty array | ✅ |
| Salary | $5,000–$8,000 per month | 5000–8000, currency = "$" | ✅ |
| Key responsibilities | Work on real product features; contribute to Viggle App, PINOC, Viggle Games, Viggle API, infrastructure or ML systems; work across rendering, backend, APIs and user-facing features | Correctly extracted the same three major responsibility areas | ✅ |

### Observations

The Viggle AI extraction was highly accurate. The system correctly identified the role, company, location, internship level, salary, major responsibilities, and a large set of technologies across front-end, backend, 3D, game-development, AI/ML, and infrastructure areas.

The main error was `postingAgeDays`. The manually reviewed posting did not provide a reliable posting date, so the expected value was null/not listed. The extractor returned `0`, likely because it interpreted date information appearing elsewhere in the captured PDF as the posting date. This shows that dates included by a job board or PDF capture can be confused with the actual job-posting date.

This posting also demonstrates that the model can distinguish between general candidate qualities and technologies that belong to different engineering areas reasonably well. It did not treat every listed technology as strictly required, instead placing the large technology list in preferred skills.

---

## Overall Extraction Evaluation

Overall, the extractor was reliable on the most important factual fields across both postings. Job title, company, location, remote status, salary values, education, technical skills, and responsibilities were generally extracted correctly.

The spot-check identified three important weaknesses:

1. The system can lose important details when summarizing experience requirements. In the New Market Group posting, the explicit 10-year requirement was reduced to only "Intermediate Developer."
2. The model may infer unsupported information. The New Market Group salary was labeled as USD even though the posting did not explicitly identify a currency.
3. Date extraction can confuse capture-page information with the actual posting date. The Viggle AI posting was assigned `postingAgeDays = 0` even though no reliable posting date was present.

Based on these two postings, I would trust the extractor for general job-market analysis, but I would manually verify high-impact fields such as required years of experience, salary currency, and posting date before using them for an individual application decision.