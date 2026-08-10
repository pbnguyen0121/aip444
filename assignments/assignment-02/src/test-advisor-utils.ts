import {
  chooseCompanyDomain,
  extractExplicitPostingDomains,
  extractPostingLegitimacySignals,
  normalizeLegitimacyAssessmentCandidate,
  recoverSingleJsonObject,
  type Logger,
  type SearchEvidence,
} from "./advise.js";
import { getRegistrableDomain } from "./tools/whois.js";
import { legitimacyAssessmentSchema } from "./schemas/advisor.js";

const silentLogger: Logger = {
  verbose: false,
  debug() {},
  warn() {},
};

const verdictCases = [
  ["Green", "GREEN"],
  ["Likely Legitimate", "GREEN"],
  ["GREEN - legitimate", "GREEN"],
  ["needs verification", "YELLOW"],
  ["likely scam", "RED"],
] as const;

for (const [raw, expected] of verdictCases) {
  const normalized = normalizeLegitimacyAssessmentCandidate(
    {
      verdict: raw,
      confidence: 80,
      greenFlags: [],
      redFlags: [],
      recommendation: "Test recommendation.",
    },
    silentLogger,
  );

  const parsed = legitimacyAssessmentSchema.parse(normalized);

  if (parsed.verdict !== expected) {
    throw new Error(`Expected ${raw} to normalize to ${expected}.`);
  }
}

const ambiguous = normalizeLegitimacyAssessmentCandidate(
  {
    verdict: "unknown",
    confidence: 50,
    greenFlags: [],
    redFlags: [],
    recommendation: "Test recommendation.",
  },
  silentLogger,
);

if (legitimacyAssessmentSchema.safeParse(ambiguous).success) {
  throw new Error("Ambiguous legitimacy verdict should not be normalized.");
}

const domainCases = [
  ["jobs.scotiabank.com", "scotiabank.com"],
  ["https://careers.example.co.uk/path", "example.co.uk"],
  ["www.company.com.au", "company.com.au"],
] as const;

for (const [input, expected] of domainCases) {
  const actual = getRegistrableDomain(input);

  if (actual !== expected) {
    throw new Error(`Expected ${input} to resolve to ${expected}, got ${actual}.`);
  }
}

const trailingJson = recoverSingleJsonObject(`\`\`\`json
{
  "verdict": "Likely Legitimate",
  "confidence": 70,
  "greenFlags": [],
  "redFlags": [],
  "recommendation": "Verify before applying."
}
\`\`\`
Extra model commentary that should not be parsed.`);

const recoveredAssessment = legitimacyAssessmentSchema.parse(
  normalizeLegitimacyAssessmentCandidate(
    JSON.parse(trailingJson.jsonText),
    silentLogger,
  ),
);

if (!trailingJson.recovered || recoveredAssessment.verdict !== "GREEN") {
  throw new Error("Trailing-text JSON recovery did not recover the verdict.");
}

let ambiguousRecoveryFailed = false;

try {
  recoverSingleJsonObject(`{"verdict":"GREEN"} trailing {"verdict":"RED"}`);
} catch {
  ambiguousRecoveryFailed = true;
}

if (!ambiguousRecoveryFailed) {
  throw new Error("Ambiguous trailing JSON-like content should not recover.");
}

const syntheticPosting = `
NorthStar Digital Solutions
Website: https://northstar-digital.example/careers
Send questions to recruiter.northstar@gmail.com.
Applicants must provide SIN, banking information, passport or driver's licence
before employment. A $750 equipment payment and $250 training deposit are
required. Urgent immediate start.
`;

const explicitDomains = extractExplicitPostingDomains(syntheticPosting);
const unrelatedEvidence: SearchEvidence[] = [
  {
    query: "NorthStar Digital Solutions careers",
    result: {
      title: "Digital Literacy Assessment Foundation",
      url: "https://digitalliteracyassessment.org/jobs",
      content: "A different organization with a vaguely similar digital name.",
      score: 0.8,
    },
  },
];

const chosenDomain = chooseCompanyDomain(
  "NorthStar Digital Solutions",
  unrelatedEvidence,
  ["gmail.com"],
  explicitDomains,
);

if (chosenDomain !== "northstar-digital.example") {
  throw new Error(`Explicit posting domain lost priority; got ${chosenDomain}.`);
}

const postingSignals = extractPostingLegitimacySignals(syntheticPosting);
const signalNames = postingSignals.map((signal) => signal.signal);

for (const expectedSignal of [
  "Sensitive PII requested before employment",
  "Banking information requested upfront",
  "Government identification requested upfront",
  "Applicant payment or equipment fee requested",
  "Generic recruiter email domain",
  "Urgency or pressure language",
]) {
  if (!signalNames.includes(expectedSignal)) {
    throw new Error(`Missing posting legitimacy signal: ${expectedSignal}.`);
  }
}

console.log("[TEST] Advisor utility smoke tests PASSED");
