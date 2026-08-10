import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { extractJobPosting } from "./extract-job.js";
import { extractPdfText } from "./pdf.js";
import { researchCompany } from "./research-company.js";
import { normalizeJob } from "./lib/normalize.js";
import { callOpenRouterStructured } from "./lib/openrouter.js";
import { logUsage } from "./lib/usage.js";
import { webSearch, type WebSearchResult } from "./tools/web-search.js";
import { lookupWhois, type WhoisResult } from "./tools/whois.js";
import { jobPostingSchema, type JobPosting } from "./schemas/job.js";
import { resumeSchema, type Resume } from "./schemas/resume.js";
import {
  gapAnalysisSchema,
  type GapAnalysis,
} from "./schemas/gap-analysis.js";
import {
  marketAnalysisSchema,
  type MarketAnalysis,
} from "./schemas/market-analysis.js";
import {
  coverLetterGuidanceSchema,
  fitAssessmentSchema,
  interviewPrepSchema,
  legitimacyAssessmentSchema,
  resumeAdaptationSchema,
  type CoverLetterGuidance,
  type FitAssessment,
  type InterviewPrep,
  type LegitimacyAssessment,
  type ResumeAdaptation,
} from "./schemas/advisor.js";

export interface Logger {
  verbose: boolean;
  debug(message: string, data?: unknown): void;
  warn(message: string): void;
}

export interface SearchEvidence {
  query: string;
  result: WebSearchResult;
}

interface LegitimacyResearch {
  evidence: SearchEvidence[];
  whois: WhoisResult | null;
  warnings: string[];
  selectedDomain: string | null;
  explicitDomains: string[];
  contactEmailDomains: string[];
  postingSignals: PostingLegitimacySignal[];
  identityVerified: boolean;
}

export interface PostingLegitimacySignal {
  signal: string;
  evidence: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

function createLogger(verbose: boolean): Logger {
  return {
    verbose,
    debug(message, data) {
      if (!verbose) {
        return;
      }

      if (data === undefined) {
        console.error(`[DEBUG] ${message}`);
      } else {
        console.error(`[DEBUG] ${message}`, data);
      }
    },
    warn(message) {
      console.error(`[WARN] ${message}`);
    },
  };
}

function cleanJsonContent(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function recoverSingleJsonObject(content: string): {
  jsonText: string;
  recovered: boolean;
} {
  const cleaned = cleanJsonContent(content);

  try {
    JSON.parse(cleaned);
    return {
      jsonText: cleaned,
      recovered: cleaned !== content,
    };
  } catch {
    // Continue to single-object recovery below.
  }

  const start = cleaned.indexOf("{");

  if (start < 0) {
    throw new Error("No JSON object start found in structured response.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < cleaned.length; index++) {
    const char = cleaned[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        const jsonText = cleaned.slice(start, index + 1);
        const trailing = cleaned.slice(index + 1).trim();

        if (trailing.includes("{") || trailing.includes("}")) {
          throw new Error(
            "Ambiguous structured response contained extra JSON-like text.",
          );
        }

        JSON.parse(jsonText);

        return {
          jsonText,
          recovered: true,
        };
      }
    }
  }

  throw new Error("No complete JSON object found in structured response.");
}

async function callStructured<T>(
  operation: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  schemaName: string,
  logger: Logger,
  normalizeParsed?: (parsed: unknown, logger: Logger) => unknown,
): Promise<T> {
  logger.debug(`OpenRouter structured call: ${operation}`);

  const response = await callOpenRouterStructured(
    systemPrompt,
    userPrompt,
    z.toJSONSchema(schema),
    schemaName,
  );

  logger.debug(`Model used for ${operation}: ${response.model}`);

  await logUsage({
    timestamp: new Date().toISOString(),
    operation,
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    cost: response.usage?.cost ?? null,
  });

  const recovered = recoverSingleJsonObject(response.content);

  if (recovered.recovered) {
    logger.debug(`Recovered JSON object for ${operation} after response cleanup`);
  }

  const parsed = JSON.parse(recovered.jsonText) as unknown;
  const normalized = normalizeParsed ? normalizeParsed(parsed, logger) : parsed;
  const validation = schema.safeParse(normalized);

  if (!validation.success) {
    logger.debug(`Schema validation failed for ${operation}`, validation.error.format());
    throw new Error(`${operation} failed Zod schema validation.`);
  }

  logger.debug(`Schema validation passed for ${operation}`);

  return validation.data;
}

function normalizeLegitimacyVerdict(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (["GREEN", "YELLOW", "RED"].includes(normalized)) {
    return normalized;
  }

  const colorMatches = ["GREEN", "YELLOW", "RED"].filter((color) =>
    new RegExp(`\\b${color}\\b`, "i").test(value),
  );

  if (colorMatches.length === 1) {
    return colorMatches[0] ?? null;
  }

  const phrase = value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");

  if (
    /\b(not legitimate|illegitimate|fraudulent|scam|unsafe|high risk|suspicious)\b/.test(
      phrase,
    )
  ) {
    return "RED";
  }

  if (
    /\b(caution|cautious|mixed|uncertain|unverified|unverifiable|needs verification|moderate risk|potentially legitimate)\b/.test(
      phrase,
    )
  ) {
    return "YELLOW";
  }

  if (
    /\b(likely legitimate|appears legitimate|legitimate|verified|reassuring|low risk|safe to apply)\b/.test(
      phrase,
    )
  ) {
    return "GREEN";
  }

  return null;
}

export function normalizeLegitimacyAssessmentCandidate(
  parsed: unknown,
  logger: Logger,
): unknown {
  if (!parsed || typeof parsed !== "object" || !("verdict" in parsed)) {
    logger.debug("Raw legitimacy verdict before normalization", null);
    logger.debug("Normalized legitimacy verdict", null);
    return parsed;
  }

  const candidate = parsed as Record<string, unknown>;
  const rawVerdict = candidate.verdict;
  const normalizedVerdict = normalizeLegitimacyVerdict(rawVerdict);

  logger.debug("Raw legitimacy verdict before normalization", rawVerdict);
  logger.debug("Normalized legitimacy verdict", normalizedVerdict);

  if (!normalizedVerdict) {
    return parsed;
  }

  return {
    ...candidate,
    verdict: normalizedVerdict,
  };
}

async function readJsonWithSchema<T>(
  filePath: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return schema.parse(JSON.parse(raw));
}

function extractContactEmailDomains(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi) ?? [];
  const domains = matches
    .map((email) => email.split("@")[1]?.toLowerCase())
    .filter((domain): domain is string => Boolean(domain));

  return [...new Set(domains)];
}

export function extractExplicitPostingDomains(text: string): string[] {
  const urlMatches =
    text.match(/\bhttps?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s),.;]*)?/gi) ?? [];
  const websiteMatches =
    text.match(/\b(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\b/gi) ?? [];
  const emailDomains = extractContactEmailDomains(text);
  const domains = [...urlMatches, ...websiteMatches, ...emailDomains]
    .map((value) => hostnameFromUrl(value) ?? value.toLowerCase().replace(/^www\./, ""))
    .map((value) => value.replace(/^[^a-z0-9]+|[^a-z0-9.]+$/gi, ""))
    .filter((value) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value))
    .filter((value) => !isGenericEmailDomain(value));

  return [...new Set(domains)];
}

function evidenceContainsExactCompany(result: WebSearchResult, companyName: string): boolean {
  const haystack = `${result.title}\n${result.content}`.toLowerCase();
  const normalizedCompany = companyName.toLowerCase().replace(/\s+/g, " ").trim();

  return haystack.includes(normalizedCompany);
}

function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function hasDomainIdentityEvidence(
  companyName: string,
  evidence: SearchEvidence[],
  domain: string | null,
): boolean {
  if (!domain) {
    return false;
  }

  return evidence.some((item) => {
    const host = hostnameFromUrl(item.result.url);

    return (
      Boolean(host) &&
      hostMatchesDomain(host as string, domain) &&
      evidenceContainsExactCompany(item.result, companyName)
    );
  });
}

function quoteMatches(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const start = Math.max(0, index - 55);
    const end = Math.min(text.length, index + match[0].length + 55);
    const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();

    matches.push(snippet);
  }

  return matches;
}

export function extractPostingLegitimacySignals(text: string): PostingLegitimacySignal[] {
  const checks: Array<{
    signal: string;
    pattern: RegExp;
    severity: PostingLegitimacySignal["severity"];
  }> = [
    {
      signal: "Sensitive PII requested before employment",
      pattern: /\b(SIN|social insurance number|ssn|social security number)\b/gi,
      severity: "HIGH",
    },
    {
      signal: "Banking information requested upfront",
      pattern: /\b(bank(?:ing)? information|direct deposit|routing number|account number)\b/gi,
      severity: "HIGH",
    },
    {
      signal: "Government identification requested upfront",
      pattern: /\b(passport|driver'?s licence|driver'?s license|government id)\b/gi,
      severity: "HIGH",
    },
    {
      signal: "Applicant payment or equipment fee requested",
      pattern: /\b(\$?\d{2,5}\s*(?:equipment|training|deposit|fee|payment)|equipment payment|training deposit)\b/gi,
      severity: "HIGH",
    },
    {
      signal: "Generic recruiter email domain",
      pattern: /[A-Z0-9._%+-]+@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|proton\.me|protonmail\.com|aol\.com)\b/gi,
      severity: "MEDIUM",
    },
    {
      signal: "Urgency or pressure language",
      pattern: /\b(urgent|immediate start|act now|limited spots|respond within|same day)\b/gi,
      severity: "MEDIUM",
    },
  ];

  const signals: PostingLegitimacySignal[] = [];

  for (const check of checks) {
    const snippets = quoteMatches(text, check.pattern);

    if (snippets.length === 0) {
      continue;
    }

    signals.push({
      signal: check.signal,
      evidence: snippets.slice(0, 3).join(" | "),
      severity: check.severity,
    });
  }

  return signals;
}

function isGenericEmailDomain(domain: string): boolean {
  return [
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
  ].includes(domain.toLowerCase());
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function chooseCompanyDomain(
  companyName: string,
  evidence: SearchEvidence[],
  emailDomains: string[],
  explicitDomains: string[],
): string | null {
  if (explicitDomains.length > 0) {
    return explicitDomains[0] ?? null;
  }

  const companyTokens = companyName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  const nonGenericEmail = emailDomains.find(
    (domain) => !isGenericEmailDomain(domain),
  );

  if (nonGenericEmail) {
    return nonGenericEmail;
  }

  const excluded = [
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
    "ziprecruiter.com",
    "wellfound.com",
    "workdayjobs.com",
    "greenhouse.io",
    "lever.co",
  ];

  for (const item of evidence) {
    const host = hostnameFromUrl(item.result.url);

    if (!host || excluded.some((domain) => host.endsWith(domain))) {
      continue;
    }

    if (
      evidenceContainsExactCompany(item.result, companyName) &&
      companyTokens.some((token) => host.includes(token))
    ) {
      return host;
    }
  }

  return null;
}

async function collectLegitimacyResearch(
  job: JobPosting,
  pdfText: string,
  logger: Logger,
): Promise<LegitimacyResearch> {
  const queries = [
    `${job.companyName} official website ${job.jobTitle}`,
    `${job.companyName} careers ${job.jobTitle}`,
    `${job.companyName} employee reviews`,
    `${job.companyName} job scam`,
    `${job.companyName} application fee training equipment fee`,
  ];

  const evidence: SearchEvidence[] = [];
  const warnings: string[] = [];
  const explicitDomains = extractExplicitPostingDomains(pdfText);
  const postingSignals = extractPostingLegitimacySignals(pdfText);

  logger.debug(
    `Legitimacy investigation hard limit: ${queries.length} Tavily searches and 1 WHOIS/RDAP lookup. Existing company research may perform additional Phase 1 searches before this step.`,
  );
  logger.debug("Explicit posting domains", explicitDomains);
  logger.debug("High-priority posting legitimacy signals", postingSignals);

  for (const query of queries) {
    try {
      logger.debug(`Tavily tool call: ${query}`);
      const search = await webSearch(query, 3);

      for (const result of search.results) {
        evidence.push({ query, result });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Tavily error";

      warnings.push(`Search failed for "${query}": ${message}`);
      logger.warn(`Legitimacy search failed for "${query}": ${message}`);
    }
  }

  const emailDomains = extractContactEmailDomains(pdfText);
  const selectedDomain = chooseCompanyDomain(
    job.companyName,
    evidence,
    emailDomains,
    explicitDomains,
  );
  const identityVerified = hasDomainIdentityEvidence(
    job.companyName,
    evidence,
    selectedDomain,
  );
  let whois: WhoisResult | null = null;

  if (!identityVerified) {
    warnings.push(
      "Company identity/domain could not be verified from exact-company web evidence; avoid treating similarly named search results as belonging to this posting.",
    );
  }

  if (selectedDomain) {
    logger.debug(`WHOIS/RDAP lookup: ${selectedDomain}`);
    whois = await lookupWhois(selectedDomain);

    if (whois.error) {
      warnings.push(`WHOIS lookup for ${selectedDomain} failed: ${whois.error}`);
      logger.warn(`WHOIS lookup failed for ${selectedDomain}: ${whois.error}`);
    }
  } else {
    warnings.push("Could not identify a company domain for WHOIS lookup.");
    logger.debug("WHOIS/RDAP lookup skipped: no domain identified");
  }

  logger.debug("Legitimacy research signals", {
    searches: queries.length,
    evidenceResults: evidence.length,
    selectedDomain,
    identityVerified,
    contactEmailDomains: emailDomains,
    whoisError: whois?.error ?? null,
  });

  return {
    evidence,
    whois,
    warnings,
    selectedDomain,
    explicitDomains,
    contactEmailDomains: emailDomains,
    postingSignals,
    identityVerified,
  };
}

function summarizeEvidence(evidence: SearchEvidence[]): string {
  if (evidence.length === 0) {
    return "No web-search evidence was returned.";
  }

  return evidence
    .slice(0, 15)
    .map((item) =>
      [
        `QUERY: ${item.query}`,
        `TITLE: ${item.result.title}`,
        `URL: ${item.result.url}`,
        `CONTENT: ${item.result.content}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

function summarizeWhois(whois: WhoisResult | null): string {
  if (!whois) {
    return "WHOIS/RDAP was not available.";
  }

  return JSON.stringify(whois, null, 2);
}

function summarizePostingSignals(signals: PostingLegitimacySignal[]): string {
  if (signals.length === 0) {
    return "No high-priority scam or sensitive-information signals were detected in the posting text.";
  }

  return signals
    .map(
      (signal) =>
        `SEVERITY: ${signal.severity}\nSIGNAL: ${signal.signal}\nEVIDENCE: ${signal.evidence}`,
    )
    .join("\n\n---\n\n");
}

function buildContext(
  job: JobPosting,
  resume: Resume,
  market: MarketAnalysis,
  gaps: GapAnalysis,
): string {
  return JSON.stringify(
    {
      job,
      resume,
      marketAnalysis: market,
      gapAnalysis: gaps,
    },
    null,
    2,
  );
}

async function assessLegitimacy(
  job: JobPosting,
  pdfText: string,
  research: LegitimacyResearch,
  logger: Logger,
): Promise<LegitimacyAssessment> {
  const emailDomains = extractContactEmailDomains(pdfText);

  const systemPrompt = `
You are a cautious job-posting legitimacy analyst.

Use only the supplied job posting, web-search evidence, email-domain signals,
posting-text evidence, and WHOIS/RDAP result. Never invent evidence.
Treat explicit suspicious signals from the posting itself as primary evidence;
they do not require confirmation from web search.

Investigate these signals when evidence is available:
- sensitive PII requested upfront
- company web presence
- official careers page
- company domain age
- contact email domain match
- suspicious generic email
- market-inconsistent compensation
- applicant payments, training fees, or equipment fees
- vague job description
- employee/company presence and reviews
- whether search results appear tied to the exact company in the posting

If something cannot be verified, explicitly say it could not be verified.
If web evidence appears to describe a similarly named but different company,
do not treat it as evidence for this posting.
Return GREEN only when evidence is reassuring, YELLOW when meaningful items
remain unverified or mildly concerning, and RED when concrete suspicious
evidence exists.
The verdict field must be exactly one of these uppercase strings:
GREEN, YELLOW, or RED. Do not return labels such as "Likely Legitimate".
`.trim();

  const userPrompt = `
JOB POSTING:
${JSON.stringify(job, null, 2)}

CONTACT EMAIL DOMAINS FOUND IN PDF:
${emailDomains.length > 0 ? emailDomains.join(", ") : "None found"}

EXPLICIT NON-GENERIC DOMAINS FOUND IN POSTING:
${research.explicitDomains.length > 0 ? research.explicitDomains.join(", ") : "None found"}

COMPANY/DOMAIN IDENTITY VERIFIED FROM EXACT-COMPANY WEB EVIDENCE:
${research.identityVerified ? "Yes" : "No"}

POSTING-TEXT LEGITIMACY SIGNALS:
${summarizePostingSignals(research.postingSignals)}

WHOIS/RDAP:
${summarizeWhois(research.whois)}

WEB SEARCH EVIDENCE:
${summarizeEvidence(research.evidence)}

RESEARCH WARNINGS:
${research.warnings.length > 0 ? research.warnings.join("\n") : "None"}
`.trim();

  return callStructured(
    "application-legitimacy-assessment",
    systemPrompt,
    userPrompt,
    legitimacyAssessmentSchema,
    "application_legitimacy_assessment",
    logger,
    normalizeLegitimacyAssessmentCandidate,
  );
}

async function assessFit(
  job: JobPosting,
  resume: Resume,
  market: MarketAnalysis,
  gaps: GapAnalysis,
  logger: Logger,
): Promise<FitAssessment> {
  const systemPrompt = `
You score how well this resume fits a specific job posting.

Use a transparent 0-100 score. The score should encourage reasonable
applications:
- 80+ = strong fit
- 50-79 = good fit and should apply
- 30-49 = stretch but may still be worth applying
- below 30 = major growth target

Never tell a reasonable candidate they are not qualified or should not apply.
Use only the supplied resume, posting, market analysis, and gap analysis.
Do not invent resume experience.
The breakdown maxPoints values should sum to 100.
`.trim();

  return callStructured(
    "application-fit-assessment",
    systemPrompt,
    buildContext(job, resume, market, gaps),
    fitAssessmentSchema,
    "application_fit_assessment",
    logger,
  );
}

async function recommendResumeAdaptation(
  job: JobPosting,
  resume: Resume,
  market: MarketAnalysis,
  gaps: GapAnalysis,
  logger: Logger,
): Promise<ResumeAdaptation> {
  const systemPrompt = `
You recommend resume adaptations for this specific posting.
Each recommendation must connect an actual job requirement to actual resume
evidence from work, projects, education, skills, or certifications.
Do not invent experience, employers, projects, or skills.
`.trim();

  return callStructured(
    "application-resume-adaptation",
    systemPrompt,
    buildContext(job, resume, market, gaps),
    resumeAdaptationSchema,
    "application_resume_adaptation",
    logger,
  );
}

async function generateCoverLetterGuidance(
  job: JobPosting,
  resume: Resume,
  market: MarketAnalysis,
  gaps: GapAnalysis,
  research: LegitimacyResearch,
  logger: Logger,
): Promise<CoverLetterGuidance> {
  const companyResearchForPrompt = research.identityVerified
    ? job.companyResearch
    : null;
  const systemPrompt = `
You create specific cover-letter guidance for a company and role.
Use only supplied evidence. Mention company-specific points only when web
evidence or company research supports them; otherwise say what to research
before writing. Do not draft a full letter.
Do not use secondary company research as fact when the company/domain identity
is not verified.
`.trim();

  const userPrompt = `
${buildContext(job, resume, market, gaps)}

COMPANY RESEARCH ON NEW JOB:
${JSON.stringify(companyResearchForPrompt, null, 2)}

COMPANY/DOMAIN IDENTITY VERIFIED:
${research.identityVerified ? "Yes" : "No"}

LEGITIMACY WEB EVIDENCE:
${summarizeEvidence(research.evidence)}
`.trim();

  return callStructured(
    "application-cover-letter-guidance",
    systemPrompt,
    userPrompt,
    coverLetterGuidanceSchema,
    "application_cover_letter_guidance",
    logger,
  );
}

async function generateInterviewPrep(
  job: JobPosting,
  resume: Resume,
  market: MarketAnalysis,
  gaps: GapAnalysis,
  research: LegitimacyResearch,
  logger: Logger,
): Promise<InterviewPrep> {
  const companyResearchForPrompt = research.identityVerified
    ? job.companyResearch
    : null;
  const systemPrompt = `
You create interview preparation for a job applicant.
Include likely interview questions, skills or technologies to review, company
topics to research, and talking points that connect actual resume evidence to
actual job requirements. Do not invent resume evidence.
Do not use secondary company research as fact when the company/domain identity
is not verified.
`.trim();

  const userPrompt = `
${buildContext(job, resume, market, gaps)}

COMPANY RESEARCH ON NEW JOB:
${JSON.stringify(companyResearchForPrompt, null, 2)}

COMPANY/DOMAIN IDENTITY VERIFIED:
${research.identityVerified ? "Yes" : "No"}

LEGITIMACY WEB EVIDENCE:
${summarizeEvidence(research.evidence)}
`.trim();

  return callStructured(
    "application-interview-prep",
    systemPrompt,
    userPrompt,
    interviewPrepSchema,
    "application_interview_prep",
    logger,
  );
}

function fallbackLegitimacy(error: string): LegitimacyAssessment {
  return {
    verdict: "YELLOW",
    confidence: 20,
    greenFlags: [],
    redFlags: [
      {
        finding: "Legitimacy assessment could not be fully completed.",
        evidence: `The advisor hit an analysis error: ${error}`,
        source: null,
      },
    ],
    recommendation:
      "Proceed cautiously: verify the company website, official careers page, recruiter email domain, and any requests for personal information before applying.",
  };
}

function fallbackFit(job: JobPosting, resume: Resume): FitAssessment {
  const resumeSkills = new Set(resume.skills.map((skill) => skill.toLowerCase()));
  const requiredMatches = job.requiredSkills.filter((skill) =>
    resumeSkills.has(skill.toLowerCase()),
  );
  const preferredMatches = job.preferredSkills.filter((skill) =>
    resumeSkills.has(skill.toLowerCase()),
  );
  const requiredMax = Math.max(job.requiredSkills.length, 1);
  const preferredMax = Math.max(job.preferredSkills.length, 1);
  const score = Math.min(
    100,
    Math.round(
      (requiredMatches.length / requiredMax) * 60 +
        (preferredMatches.length / preferredMax) * 20 +
        (resume.projects.length > 0 ? 15 : 0) +
        (resume.education.length > 0 ? 5 : 0),
    ),
  );

  const category =
    score >= 80
      ? "strong fit"
      : score >= 50
        ? "good fit and should apply"
        : score >= 30
          ? "stretch but may still be worth applying"
          : "major growth target";

  return {
    score,
    category,
    breakdown: [
      {
        factor: "Required skill overlap",
        points: Math.round((requiredMatches.length / requiredMax) * 60),
        maxPoints: 60,
        evidence:
          requiredMatches.length > 0
            ? requiredMatches.join(", ")
            : "No exact required-skill matches found in the resume skills list.",
      },
      {
        factor: "Preferred skill overlap",
        points: Math.round((preferredMatches.length / preferredMax) * 20),
        maxPoints: 20,
        evidence:
          preferredMatches.length > 0
            ? preferredMatches.join(", ")
            : "No exact preferred-skill matches found in the resume skills list.",
      },
      {
        factor: "Project and education evidence",
        points: (resume.projects.length > 0 ? 15 : 0) + (resume.education.length > 0 ? 5 : 0),
        maxPoints: 20,
        evidence: "Resume includes project and education evidence relevant to entry-level applications.",
      },
    ],
    summary:
      "This fallback score uses exact skill overlap because the LLM fit assessment was unavailable. Treat it as a conservative baseline, not a rejection signal.",
  };
}

function fallbackResumeAdaptation(job: JobPosting, resume: Resume): ResumeAdaptation {
  const project = resume.projects[0];
  const target = job.requiredSkills[0] ?? job.keyResponsibilities[0] ?? job.jobTitle;

  return {
    recommendations: [
      {
        targetRequirement: target,
        resumeEvidence: project
          ? `${project.name}: ${project.description ?? project.technologies.join(", ")}`
          : "Resume skills and education sections.",
        suggestedChange:
          "Mirror the posting's language where it accurately matches existing resume evidence, and avoid adding skills that are not already supported.",
      },
    ],
  };
}

function fallbackCoverLetter(job: JobPosting): CoverLetterGuidance {
  return {
    openingAngle: `Open with interest in the ${job.jobTitle} role at ${job.companyName} and connect it to verified resume project work.`,
    companySpecificPoints: [
      "Research the official company website and careers page before naming company-specific motivations.",
    ],
    roleSpecificPoints: job.requiredSkills.slice(0, 3),
    evidenceToHighlight: job.keyResponsibilities.slice(0, 3),
    cautions: [
      "Do not mention company facts that were not verified in the supplied research.",
    ],
  };
}

function fallbackInterviewPrep(job: JobPosting, resume: Resume): InterviewPrep {
  return {
    likelyQuestions: [
      `How has your experience prepared you for ${job.jobTitle}?`,
      `Which project best demonstrates the skills needed for this role?`,
    ],
    skillsToReview: [...job.requiredSkills, ...job.preferredSkills].slice(0, 8),
    companyTopicsToResearch: [
      `${job.companyName} official website`,
      `${job.companyName} careers page`,
    ],
    talkingPoints: resume.projects.slice(0, 3).map((project) => ({
      resumeEvidence: `${project.name}: ${project.technologies.join(", ")}`,
      roleConnection:
        "Connect the project to matching technologies or responsibilities from the posting.",
    })),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function list(items: string[]): string {
  if (items.length === 0) {
    return "<p class=\"muted\">None identified.</p>";
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function evidenceList(items: LegitimacyAssessment["greenFlags"]): string {
  if (items.length === 0) {
    return "<p class=\"muted\">None identified.</p>";
  }

  return `<ul>${items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.finding)}</strong><br><span>${escapeHtml(
          item.evidence,
        )}</span>${item.source ? `<br><a href="${escapeHtml(item.source)}">${escapeHtml(item.source)}</a>` : ""}</li>`,
    )
    .join("")}</ul>`;
}

function renderReport(data: {
  job: JobPosting;
  legitimacy: LegitimacyAssessment;
  fit: FitAssessment;
  resumeAdaptation: ResumeAdaptation;
  coverLetter: CoverLetterGuidance;
  interviewPrep: InterviewPrep;
  whois: WhoisResult | null;
  generatedAt: string;
}): string {
  const verdictClass = data.legitimacy.verdict.toLowerCase();
  const warning =
    data.legitimacy.verdict === "RED" || data.legitimacy.verdict === "YELLOW"
      ? `<div class="warning"><strong>${escapeHtml(data.legitimacy.verdict)} legitimacy verdict.</strong> ${escapeHtml(data.legitimacy.recommendation)}</div>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Application Advisor Report</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2933; background: #f6f7f9; line-height: 1.5; }
    header { background: #18324a; color: white; padding: 32px 48px; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px 20px 48px; }
    h1, h2, h3 { margin: 0; line-height: 1.2; }
    h1 { font-size: 30px; }
    h2 { font-size: 22px; margin-bottom: 16px; color: #18324a; }
    h3 { font-size: 16px; margin: 18px 0 8px; }
    section { background: white; border: 1px solid #d9dee5; border-radius: 8px; padding: 24px; margin-bottom: 18px; }
    ul { padding-left: 22px; }
    li { margin: 8px 0; }
    a { color: #1d5f99; overflow-wrap: anywhere; }
    .meta { margin-top: 10px; color: #dce6ef; }
    .pill { display: inline-block; border-radius: 999px; padding: 5px 10px; font-weight: 700; font-size: 13px; }
    .green { background: #dff6e5; color: #116329; }
    .yellow { background: #fff1c2; color: #7a4d00; }
    .red { background: #ffe0df; color: #9a1c14; }
    .warning { border-left: 5px solid #b42318; background: #fff4f3; padding: 14px 16px; margin: 16px 0; }
    .score { font-size: 42px; font-weight: 800; color: #18324a; }
    .muted { color: #667085; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .box { border: 1px solid #e1e5ea; border-radius: 8px; padding: 14px; background: #fbfcfd; }
    .breakdown { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .breakdown th, .breakdown td { text-align: left; border-bottom: 1px solid #e1e5ea; padding: 10px; vertical-align: top; }
    .breakdown th { color: #344054; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(data.job.jobTitle)} at ${escapeHtml(data.job.companyName)}</h1>
    <div class="meta">Generated ${escapeHtml(data.generatedAt)}${data.job.location ? ` | ${escapeHtml(data.job.location)}` : ""}</div>
  </header>
  <main>
    <section>
      <h2>1. Legitimacy Assessment</h2>
      <span class="pill ${verdictClass}">${escapeHtml(data.legitimacy.verdict)} | ${data.legitimacy.confidence}% confidence</span>
      ${warning}
      <div class="grid">
        <div class="box"><h3>Green Flags</h3>${evidenceList(data.legitimacy.greenFlags)}</div>
        <div class="box"><h3>Red Flags</h3>${evidenceList(data.legitimacy.redFlags)}</div>
      </div>
      <h3>WHOIS/RDAP Summary</h3>
      <p>${data.whois ? escapeHtml(JSON.stringify(data.whois, null, 2)) : "No WHOIS/RDAP result available."}</p>
    </section>
    <section>
      <h2>2. Fit Assessment</h2>
      <div class="score">${data.fit.score}/100</div>
      <p><strong>${escapeHtml(data.fit.category)}</strong></p>
      <p>${escapeHtml(data.fit.summary)}</p>
      <table class="breakdown">
        <thead><tr><th>Factor</th><th>Points</th><th>Evidence</th></tr></thead>
        <tbody>${data.fit.breakdown
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.factor)}</td><td>${item.points}/${item.maxPoints}</td><td>${escapeHtml(item.evidence)}</td></tr>`,
          )
          .join("")}</tbody>
      </table>
    </section>
    <section>
      <h2>3. Resume Adaptation</h2>
      ${data.resumeAdaptation.recommendations
        .map(
          (item) =>
            `<div class="box"><h3>${escapeHtml(item.targetRequirement)}</h3><p><strong>Resume evidence:</strong> ${escapeHtml(item.resumeEvidence)}</p><p><strong>Suggested change:</strong> ${escapeHtml(item.suggestedChange)}</p></div>`,
        )
        .join("")}
    </section>
    <section>
      <h2>4. Cover Letter Guidance</h2>
      <h3>Opening Angle</h3>
      <p>${escapeHtml(data.coverLetter.openingAngle)}</p>
      <div class="grid">
        <div class="box"><h3>Company-Specific Points</h3>${list(data.coverLetter.companySpecificPoints)}</div>
        <div class="box"><h3>Role-Specific Points</h3>${list(data.coverLetter.roleSpecificPoints)}</div>
        <div class="box"><h3>Evidence to Highlight</h3>${list(data.coverLetter.evidenceToHighlight)}</div>
        <div class="box"><h3>Cautions</h3>${list(data.coverLetter.cautions)}</div>
      </div>
    </section>
    <section>
      <h2>5. Interview Prep</h2>
      <div class="grid">
        <div class="box"><h3>Likely Questions</h3>${list(data.interviewPrep.likelyQuestions)}</div>
        <div class="box"><h3>Skills to Review</h3>${list(data.interviewPrep.skillsToReview)}</div>
        <div class="box"><h3>Company Topics</h3>${list(data.interviewPrep.companyTopicsToResearch)}</div>
      </div>
      <h3>Talking Points</h3>
      ${data.interviewPrep.talkingPoints
        .map(
          (item) =>
            `<div class="box"><p><strong>Resume evidence:</strong> ${escapeHtml(item.resumeEvidence)}</p><p><strong>Role connection:</strong> ${escapeHtml(item.roleConnection)}</p></div>`,
        )
        .join("")}
    </section>
  </main>
</body>
</html>`;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const secrets = [openRouterKey, tavilyKey].filter(
    (secret): secret is string => typeof secret === "string" && secret.length > 0,
  );

  return secrets.reduce(
    (message, secret) => message.replaceAll(secret, "[REDACTED]"),
    raw,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || process.env.LOG_LEVEL === "debug";
  const pdfPathArg = args.find((arg) => arg !== "--verbose");
  const logger = createLogger(verbose);

  if (!pdfPathArg) {
    throw new Error("Usage: npm run advise -- <pdf-path> [--verbose]");
  }

  const pdfPath = path.resolve(process.cwd(), pdfPathArg);
  const outputPath = path.resolve(process.cwd(), "reports/application-report.html");

  logger.debug(`PDF extraction starting: ${pdfPath}`);
  const pdfText = await extractPdfText(pdfPath);
  logger.debug(`PDF extraction complete: ${pdfText.length} characters`);

  logger.debug("Extracting structured job posting with Phase 1 logic");
  const extracted = await extractJobPosting(pdfText);
  let job = normalizeJob(jobPostingSchema.parse(extracted.job));
  logger.debug("Job extraction schema validation passed", {
    companyName: job.companyName,
    jobTitle: job.jobTitle,
  });

  const marketPath = path.resolve(process.cwd(), "data/analysis/market-analysis.json");
  const resumePath = path.resolve(process.cwd(), "data/resume/resume.json");
  const gapPath = path.resolve(process.cwd(), "data/analysis/gap-analysis.json");

  logger.debug("Loading Phase 2 analysis artifacts");
  const [market, resume, gaps] = await Promise.all([
    readJsonWithSchema(marketPath, marketAnalysisSchema),
    readJsonWithSchema(resumePath, resumeSchema),
    readJsonWithSchema(gapPath, gapAnalysisSchema),
  ]);

  try {
    logger.debug(`Researching company with existing infrastructure: ${job.companyName}`);
    job = {
      ...job,
      companyResearch: await researchCompany(job),
    };
  } catch (error) {
    logger.warn(`Company research failed; continuing: ${sanitizeError(error)}`);
    job = {
      ...job,
      companyResearch: null,
    };
  }

  const legitimacyResearch = await collectLegitimacyResearch(job, pdfText, logger);

  let legitimacy: LegitimacyAssessment;
  try {
    legitimacy = await assessLegitimacy(job, pdfText, legitimacyResearch, logger);
  } catch (error) {
    const message = sanitizeError(error);
    logger.warn(`Legitimacy assessment failed; using cautionary fallback: ${message}`);
    legitimacy = fallbackLegitimacy(message);
  }

  let fit: FitAssessment;
  try {
    fit = await assessFit(job, resume, market, gaps, logger);
    logger.debug("Fit-scoring breakdown", fit.breakdown);
  } catch (error) {
    logger.warn(`Fit assessment failed; using deterministic fallback: ${sanitizeError(error)}`);
    fit = fallbackFit(job, resume);
  }

  let resumeAdaptation: ResumeAdaptation;
  try {
    resumeAdaptation = await recommendResumeAdaptation(
      job,
      resume,
      market,
      gaps,
      logger,
    );
  } catch (error) {
    logger.warn(`Resume adaptation failed; using fallback: ${sanitizeError(error)}`);
    resumeAdaptation = fallbackResumeAdaptation(job, resume);
  }

  let coverLetter: CoverLetterGuidance;
  try {
    coverLetter = await generateCoverLetterGuidance(
      job,
      resume,
      market,
      gaps,
      legitimacyResearch,
      logger,
    );
  } catch (error) {
    logger.warn(`Cover-letter guidance failed; using fallback: ${sanitizeError(error)}`);
    coverLetter = fallbackCoverLetter(job);
  }

  let interviewPrep: InterviewPrep;
  try {
    interviewPrep = await generateInterviewPrep(
      job,
      resume,
      market,
      gaps,
      legitimacyResearch,
      logger,
    );
  } catch (error) {
    logger.warn(`Interview prep failed; using fallback: ${sanitizeError(error)}`);
    interviewPrep = fallbackInterviewPrep(job, resume);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    renderReport({
      job,
      legitimacy,
      fit,
      resumeAdaptation,
      coverLetter,
      interviewPrep,
      whois: legitimacyResearch.whois,
      generatedAt: new Date().toISOString(),
    }),
    "utf8",
  );

  logger.debug(`Output path: ${outputPath}`);
  console.log(`[SAVE] ${outputPath}`);
}

function isCliEntryPoint(): boolean {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(entryPoint)).href;
}

if (isCliEntryPoint()) {
  main().catch((error) => {
    console.error("[FATAL]", sanitizeError(error));
    process.exit(1);
  });
}
