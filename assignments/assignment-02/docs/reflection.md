# Assignment 2 Reflection

## 1. Did you structure your phases as workflows, agents, or a hybrid? What factors influenced this decision?

I structured the project as a hybrid of workflows and agent-style components.

Phase 1 and Phase 2 are mostly workflows because their steps are predictable. For Phase 1, the program reads a PDF, extracts the text, sends it to the LLM for structured extraction, validates the result, researches the company, and saves the JSON file. After enough postings are processed, the market analysis is generated. Phase 2 is also mostly a workflow because it parses my resume, compares it with the market analysis, and generates a gap analysis.

I think workflows were better for these parts because I wanted the output and file paths to be predictable. It also made each step easier to test separately.

Phase 3 is more agent-like, especially the legitimacy investigation. It needs to decide what information to search for, use Tavily web searches, perform a WHOIS/RDAP lookup, examine the results, and then produce a verdict. However, I still put hard limits around the agent. The legitimacy investigation is limited to 5 Tavily searches and 1 WHOIS/RDAP lookup.

So overall, I used a hybrid design. I used deterministic workflows when I already knew the sequence of steps, and more agent-style behaviour when the program needed to investigate external information and make decisions based on what it found.

---

## 2. Which prompt engineering choices most improved extraction consistency across varied job postings?

One of the most useful choices was asking the LLM to return structured JSON instead of normal text.

I defined the expected fields such as job title, company name, location, remote status, required skills, preferred skills, experience level, education, salary, responsibilities, and company research. I also validated the returned data with Zod.

This helped because job postings have very different formats. Some postings have clear sections such as "Requirements" and "Responsibilities", while other postings mix this information together. Having a fixed schema gave the model the same target structure for every posting.

Another useful choice was telling the model not to invent information when a value was not available. In those situations, the expected behaviour was to use null or an empty array.

Structured output was not completely reliable with the free models. During testing, some responses came inside Markdown JSON fences, and some responses contained valid JSON followed by extra text. I added parsing and recovery logic for these cases while still validating the final result against the schema.

The evaluation also showed that prompting cannot solve everything. For example, one posting required around 10 years of Developer experience, but the extractor summarized this only as "Intermediate Developer." Another extraction assigned USD to a salary even though the source did not clearly support that currency.

Because of this, I think structured prompts plus validation improved consistency a lot, but important factual fields still need validation and sometimes human review.

---

## 3. How did you design the legitimacy agent? What signals did you prioritize and why? What limitations does it have?

The legitimacy agent combines information from the job posting with external research.

It uses Tavily web search to look for the company, careers information, employee information, and possible scam signals. It also uses WHOIS/RDAP to investigate the domain associated with the posting.

The legitimacy investigation has a hard limit of 5 Tavily searches and 1 WHOIS/RDAP lookup.

I prioritized signals that would directly affect whether it is safe for someone to continue with an application.

Some important green signals are:

- An established company website
- A verifiable company careers presence
- A company domain with registration information
- Job information that is consistent with other public information
- No unusual request for money or sensitive information

Some important red signals are:

- Requests for SIN or other sensitive PII before employment
- Banking information requested during the initial application process
- Requests for passport or government identification
- Equipment payments or training deposits
- Generic recruiter email domains such as Gmail
- Unverified or suspicious domains
- Urgency language
- Company identity that cannot be independently verified

One important lesson came from my synthetic scam test. The first version searched for "NorthStar Digital Solutions" and found similarly named organizations. It then selected a domain belonging to a different organization for WHOIS research. This could create misleading evidence.

I changed the system so that an explicit domain found inside the posting has priority. Search-result domains require stronger evidence connecting them to the exact company. If the identity cannot be verified, the system records uncertainty instead of guessing.

I also added direct scam-signal extraction from the posting itself. This is important because obvious requests for SIN, banking information, government identification, or applicant payments should not depend on a web search finding the same information.

After the fixes, my synthetic suspicious posting received a RED verdict with 100% confidence, while the legitimate Google posting received GREEN with 100% confidence.

There are still limitations. Companies can have similar names, WHOIS information can be unavailable, search results can be incomplete, and an LLM can misunderstand evidence. I also found that some downstream generated content could still contain information from similarly named companies even after the legitimacy identity logic was improved. Therefore, I would use this system as decision support, not as final proof that a posting is legitimate.

---

## 4. What models did you use, and how did cost influence your choices?

Cost influenced my model selection a lot.

I wanted to complete the assignment using free OpenRouter models where possible instead of repeatedly using paid models during development and testing.

The main free models I tested included Google Gemma through OpenRouter and `openai/gpt-oss-20b:free`. I also originally configured a paid OpenAI model as an option, but my preference during development was to use a free model first and only move to a paid model if the free option could not complete the task reliably.

This approach reduced API cost because the assignment required many LLM calls across extraction, company research, market analysis, gap analysis, legitimacy assessment, fit scoring, resume adaptation, cover-letter guidance, and interview preparation.

However, free models introduced some problems.

I experienced OpenRouter rate limits several times. The program needed retry behaviour so a temporary provider rate limit would not immediately stop the whole pipeline.

I also found differences in structured-output reliability. One free model returned fields that did not match my schema, while another sometimes returned JSON inside Markdown fences or added extra text after a valid JSON object.

Because of this, using free models reduced cost but increased the amount of defensive code needed for retries, parsing, normalization, and schema validation.

My final approach was therefore not just choosing the cheapest model. It was using free models where possible while adding enough validation and recovery logic to make them practical for the assignment.

---

## 5. Coding agent process for Phase 3

I used OpenAI Codex as the coding agent for Phase 3.

My initial instructions were to implement the Application Advisor using the existing Phase 1 and Phase 2 code instead of rebuilding the project. I asked it to support:

`npm run advise -- <pdf-path>`

and a verbose mode.

I also asked it to reuse the existing PDF/job extraction and company research, load the Phase 2 artifacts, add a WHOIS/RDAP tool, use Tavily with a deterministic search limit, use OpenRouter structured outputs with Zod validation, and generate one self-contained HTML application report containing the five required sections.

The first implementation was successful enough to run the full Phase 3 pipeline. It generated the report and correctly reused much of the existing project structure.

However, live testing found several issues, so the coding-agent process took three main iterations.

### Iteration 1

Codex built the first complete Phase 3 implementation.

It correctly:

- Reused the existing Phase 1 extraction logic
- Loaded the Phase 2 analysis artifacts
- Added WHOIS/RDAP support
- Added Tavily legitimacy research
- Added structured schemas
- Generated all five report sections
- Added verbose debugging
- Generated the final HTML report

The first live Scotiabank test completed end-to-end, but the legitimacy structured output failed because the model returned a verdict that did not exactly match the strict enum.

The WHOIS tool also attempted to query `jobs.scotiabank.com` instead of the registrable base domain.

### Iteration 2

I gave these live-test failures back to Codex.

It added controlled verdict normalization while keeping the strict GREEN/YELLOW/RED schema.

It also improved WHOIS/RDAP domain handling so a hostname such as:

`jobs.scotiabank.com`

could be resolved to the registrable domain:

`scotiabank.com`

The second Scotiabank live test then successfully produced a GREEN legitimacy verdict.

### Iteration 3

The synthetic suspicious posting exposed two more problems.

First, the free model returned a valid JSON object followed by additional content. The parser failed with an "Unexpected non-whitespace character after JSON" error.

Second, web searches for the synthetic company returned similarly named organizations, and the system selected an unrelated domain for WHOIS research.

I gave these failures back to Codex.

Codex added safer JSON-object recovery and stronger company-identity grounding. It also added direct scam-signal extraction from the job posting.

After these changes, the same synthetic posting:

- Used the explicit synthetic posting domain
- Failed WHOIS/RDAP verification as expected
- Detected sensitive PII and banking requests
- Detected government-ID requests
- Detected the generic Gmail recruiter address
- Recovered the malformed structured response safely
- Produced a RED legitimacy verdict with 100% confidence

Codex got the overall architecture and integration with the existing codebase mostly right. The biggest problems were edge cases that were difficult to discover without real live testing.

I did not manually rewrite Phase 3 after Codex generated it. My role was mainly to run the code, inspect the real outputs, identify failures, describe those failures precisely to the coding agent, and test the fixes again.

This process showed me that a coding agent can produce a large amount of working code quickly, but it still needs human testing and review, especially when the application depends on LLM output and external search results.

---

## 6. What other AI tools did you use while building?

Besides Codex, I used ChatGPT throughout the assignment.

One place where ChatGPT helped was breaking the assignment into smaller steps. Instead of trying to build all three phases at once, I used it to review the requirements, plan the folder structure and workflow, and decide what to test before moving to the next step.

ChatGPT was also useful when debugging live output. For example, after running the synthetic suspicious posting, the legitimacy result fell back instead of producing RED. ChatGPT helped identify that there were actually two different problems: malformed structured JSON and company identity contamination from web-search results. Those observations were then turned into more specific instructions for Codex.

However, I did not accept every AI suggestion without checking it.

One important example was the fit evaluation. The Google Early Career posting received a numeric fit score of 80/100, but the generated report described it as a "stretch." According to the assignment's intended scoring ranges, 80% should be a strong fit. I kept this as a documented failure instead of assuming the AI-generated recommendation was correct.

Another example was job extraction. Some outputs looked reasonable at first, but manual comparison with the original postings showed missing experience details and an unsupported salary currency.

These cases showed me that AI was most useful as a development and reasoning assistant when I could compare its output with source evidence, tests, schemas, logs, and assignment requirements. I would not rely on AI-generated output without checking it.
