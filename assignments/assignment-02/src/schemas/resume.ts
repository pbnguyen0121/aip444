import { z } from "zod";

export const educationSchema = z.object({
  institution: z.string().nullable(),
  credential: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});

export const workExperienceSchema = z.object({
  company: z.string().nullable(),
  title: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  responsibilities: z.array(z.string()),
  technologies: z.array(z.string()),
});

export const projectSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  technologies: z.array(z.string()),
});

export const certificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullable(),
  date: z.string().nullable(),
});

export const resumeSchema = z.object({
  name: z.string().nullable(),

  education: z.array(educationSchema),

  workExperience: z.array(workExperienceSchema),

  skills: z.array(z.string()),

  projects: z.array(projectSchema),

  certifications: z.array(certificationSchema),
});

export type Resume = z.infer<typeof resumeSchema>;
