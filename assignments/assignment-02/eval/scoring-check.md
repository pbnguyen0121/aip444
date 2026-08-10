# Scoring Check

## Purpose

This evaluation checks whether the Phase 3 Application Advisor produces reasonable fit scores for postings with different expected fit levels. It also checks whether the system encourages applying appropriately and whether repeated runs on the same posting produce reasonably consistent results.

---

## Posting 1: Software Engineer (C++) — Scotiabank

### Expected Fit

**Expected level: Weak fit / major growth target**

I expected this posting to be a weak fit because the position requires 5+ years of enterprise application development experience using C++. My resume contains C/C++ academic project experience, SQL, Git, REST APIs, testing, and other software-development skills, but I do not have 5+ years of professional enterprise C++ experience or Capital Markets/Derivatives experience.

### Advisor Result — Run 1

- Fit score: **25/100**
- Recommendation: **Major growth target**

Main strengths identified:

- C/C++ project experience
- SQL and relational database experience
- Git/source-code management
- Automated testing and TDD
- REST API and backend-development exposure

Main gaps identified:

- 5+ years of enterprise C++ development
- Professional enterprise software-development experience
- Unix/Linux and Shell scripting
- Jenkins/Maven and related CI/CD tooling
- Capital Markets and Derivatives domain knowledge

### Do I Agree?

Yes. I agree with the low score because the largest gap is not a small technical skill that could quickly be added to the resume. The posting explicitly requires several years of professional enterprise C++ experience, while most of my relevant experience comes from academic and personal projects.

The system still recognized transferable experience instead of treating the application as having no relevant value. It connected my C/C++ project, automated testing, SQL, Git, ETL, and REST API experience to individual requirements.

### Did the System Encourage Applying Appropriately?

Yes. The system classified the position as a major growth target instead of simply saying that I should never apply. For this posting, I think the low score is reasonable because the experience gap is significant.

---

## Consistency Check — Scotiabank

I ran the Application Advisor on the same Scotiabank posting twice.

| Item | Run 1 | Run 2 | Consistent? |
|---|---|---|---|
| Overall fit score | 25/100 | 25/100 | ✅ |
| Overall recommendation | Major growth target | Major growth target | ✅ |
| Main experience gap | Missing 5+ years enterprise C++ experience | Missing 5+ years enterprise C++ experience | ✅ |
| C/C++ project recognized | Yes | Yes | ✅ |
| SQL/backend experience recognized | Yes | Yes | ✅ |
| Professional experience identified as major weakness | Yes | Yes | ✅ |

### Consistency Observation

The two runs were highly consistent. Both produced the same overall score of 25/100 and the same overall recommendation.

The exact scoring categories and wording changed slightly between runs, but the important reasoning remained stable. Both runs recognized some relevant technical experience while identifying the missing 5+ years of professional enterprise C++ experience as the largest gap.

This level of variation is acceptable for an LLM-generated analysis because the important decision-level result remained stable.

---

## Posting 2: Software Developer, Early Career, Campus — Google

### Expected Fit

**Expected level: Good to strong fit and substantially stronger than Scotiabank**

I expected this posting to receive a much higher score than the Scotiabank role because it is specifically an Early Career / Campus position.

The posting asks for education in Computer Science or a similar technical field, or equivalent practical experience. It also requires experience with data structures or algorithms, software development in one or more programming languages, and AI productivity tools.

The posting allows relevant data-structure and algorithm experience to come from coursework, academic projects, research, internships, school experience, professional experience, or open-source coding.

My resume contains a Computer Programming and Analysis education, multiple software-development projects, C++, Python, JavaScript, Node.js, databases, APIs, Agile/TDD experience, and other technical work that is substantially closer to this role than the senior Scotiabank position.

### Advisor Result

- Fit score: **80/100**
- Generated recommendation label: **Stretch but may still be worth applying**

Scoring breakdown:

| Factor | Score |
|---|---:|
| Educational Alignment | 20/30 |
| Core Technical Skills | 35/40 |
| Project & Practical Experience | 20/20 |
| Workflow & Methodology | 5/10 |
| **Total** | **80/100** |

The advisor identified several strong matches:

- Relevant Computer Programming and Analysis education
- Python, C++, JavaScript, and Node.js software development
- Data structures and algorithm-related experience
- Multiple full-stack and data-processing projects
- API and database experience
- Agile, Scrum, TDD, Git, and Jira experience

The main limitation identified was that I have an Advanced Diploma rather than a Bachelor's degree, although the posting also permits equivalent practical experience.

### Do I Agree?

I generally agree with the **80/100 score**.

The Google position is designed for early-career candidates, and my academic and project background is much closer to its requirements than the Scotiabank role. The advisor correctly gave strong scores for technical skills and practical projects while deducting some points for educational alignment and professional workflow experience.

The result also demonstrates useful score separation:

- Scotiabank: **25/100**
- Google: **80/100**

This is a large difference and matches my own expectation that the Google role is substantially more appropriate for my current career level.

### Did the System Encourage Applying Appropriately?

**Not completely.**

The numeric score was reasonable, but the generated recommendation label was inconsistent with the scoring policy.

The Assignment 2 scoring guidance defines:

- 80%+ as a strong fit
- 50–79% as a good fit where applying should be encouraged
- 30–49% as a stretch but still worth considering
- Below 30% as a major growth target

The Google report gave a score of **80/100**, but labeled it **"stretch but may still be worth applying."**

According to the intended scoring policy, an 80/100 result should instead be classified as a **strong fit** and the applicant should be encouraged to apply.

This appears to be a mapping inconsistency between the generated numerical score and the generated recommendation label.

---

## Overall Scoring Evaluation

The scoring system successfully distinguished between two postings with very different levels of fit.

The senior Scotiabank C++ position received **25/100**, while the Google Early Career position received **80/100**. This difference is reasonable based on the requirements of the two postings and the evidence in my resume.

The Scotiabank consistency test was also successful. Two separate runs produced the same 25/100 score and the same overall conclusion, although some wording and scoring categories varied.

The main weakness discovered was the relationship between the numeric score and the recommendation label. The Google posting received 80/100, but the system labeled it as a stretch application. Under the intended scoring policy, 80/100 should be classified as a strong fit.

Therefore, I consider the **numeric fit scoring reasonably reliable**, but the final recommendation label should be deterministically derived from the numeric score rather than independently generated by the LLM. This would prevent contradictions between the score and recommendation.