import type { JobPosting } from "../schemas/job.js";

function normalizeNullableString(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const cleaned = value.trim();

  const missingValues = [
    "null",
    "unknown",
    "not listed",
    "not specified",
    "n/a",
    "none",
  ];

  if (missingValues.includes(cleaned.toLowerCase())) {
    return null;
  }

  return cleaned;
}

export function normalizeJob(job: JobPosting): JobPosting {
  return {
    ...job,

    location: normalizeNullableString(job.location),

    remoteStatus: normalizeNullableString(job.remoteStatus),

    experienceLevel: normalizeNullableString(job.experienceLevel),

    salaryCurrency: normalizeNullableString(job.salaryCurrency),

    companyResearch: job.companyResearch
      ? {
          ...job.companyResearch,

          companySize: normalizeNullableString(job.companyResearch.companySize),

          industry: normalizeNullableString(job.companyResearch.industry),
        }
      : null,
  };
}
