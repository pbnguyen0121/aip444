import { jobPostingSchema } from "./schemas/job.js";

const sampleJob = {
  jobTitle: "Junior Full Stack Developer – Co-op",
  companyName: "Magna International",
  location: "333 Market Drive, Milton, ON L9T 4Z7",
  remoteStatus: null,

  postingAgeDays: null,

  requiredSkills: ["Software development", "Problem solving"],

  preferredSkills: [],

  experienceLevel: "Junior / Co-op",

  educationRequirements: [
    "Bachelor's degree or Community College diploma in a related field",
  ],

  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,

  keyResponsibilities: [
    "Plan and design software applications",
    "Develop and test applications",
    "Maintain software applications",
  ],

  companyResearch: null,
};

const result = jobPostingSchema.safeParse(sampleJob);

if (result.success) {
  console.log("[TEST] Job schema validation PASSED");
  console.log(result.data);
} else {
  console.error("[TEST] Job schema validation FAILED");
  console.error(result.error.format());
  process.exit(1);
}
