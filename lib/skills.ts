/**
 * Known technical skill vocabulary used for resume parsing and JD matching.
 *
 * The original Phase 1 implementation hard-coded 13 keywords, which meant
 * the vast majority of real resumes/job descriptions were scored against an
 * almost-empty vocabulary. This list is still not exhaustive, but it covers
 * the common languages, frameworks, cloud/data tooling, and practices that
 * an early-career software/technical candidate (the platform's stated
 * target audience) is likely to list.
 *
 * `aliases` lets us treat common variants ("JS", "Node.js", "Postgres") as
 * the same underlying skill so matching doesn't miss obvious synonyms.
 */
export interface SkillDefinition {
  canonical: string;
  aliases?: string[];
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  // Languages
  { canonical: "JavaScript", aliases: ["JS"] },
  { canonical: "TypeScript", aliases: ["TS"] },
  { canonical: "Python" },
  { canonical: "Java" },
  { canonical: "C++" },
  { canonical: "C#" },
  { canonical: "C" },
  { canonical: "Go", aliases: ["Golang"] },
  { canonical: "Rust" },
  { canonical: "Ruby" },
  { canonical: "PHP" },
  { canonical: "Swift" },
  { canonical: "Kotlin" },
  { canonical: "Scala" },
  { canonical: "R" },
  { canonical: "MATLAB" },
  { canonical: "Verilog" },
  { canonical: "VHDL" },
  { canonical: "SQL" },
  { canonical: "HTML" },
  { canonical: "CSS" },

  // Frontend
  { canonical: "React", aliases: ["React.js", "ReactJS"] },
  { canonical: "Next.js", aliases: ["NextJS"] },
  { canonical: "Vue", aliases: ["Vue.js"] },
  { canonical: "Angular" },
  { canonical: "Svelte" },
  { canonical: "Tailwind CSS", aliases: ["TailwindCSS", "Tailwind"] },
  { canonical: "Redux" },

  // Backend / runtimes
  { canonical: "Node.js", aliases: ["NodeJS"] },
  { canonical: "Express", aliases: ["Express.js"] },
  { canonical: "Django" },
  { canonical: "Flask" },
  { canonical: "FastAPI" },
  { canonical: "Spring Boot", aliases: ["Spring Framework"] },
  { canonical: ".NET", aliases: ["DotNet", "ASP.NET"] },
  { canonical: "GraphQL" },
  { canonical: "REST", aliases: ["RESTful", "REST API"] },

  // Data / ML
  { canonical: "Pandas" },
  { canonical: "NumPy" },
  { canonical: "TensorFlow" },
  { canonical: "PyTorch" },
  { canonical: "Scikit-learn", aliases: ["sklearn"] },
  { canonical: "Machine Learning", aliases: ["ML"] },
  { canonical: "Deep Learning" },
  { canonical: "NLP" },
  { canonical: "Spark", aliases: ["Apache Spark"] },
  { canonical: "Hadoop" },
  { canonical: "ETL" },

  // Databases
  { canonical: "PostgreSQL", aliases: ["Postgres"] },
  { canonical: "MySQL" },
  { canonical: "MongoDB", aliases: ["Mongo"] },
  { canonical: "Redis" },
  { canonical: "SQLite" },
  { canonical: "DynamoDB" },
  { canonical: "Elasticsearch" },

  // Cloud / infra
  { canonical: "AWS", aliases: ["Amazon Web Services"] },
  { canonical: "GCP", aliases: ["Google Cloud", "Google Cloud Platform"] },
  { canonical: "Azure" },
  { canonical: "Docker" },
  { canonical: "Kubernetes", aliases: ["K8s"] },
  { canonical: "Terraform" },
  { canonical: "CI/CD", aliases: ["CICD"] },
  { canonical: "DevOps" },
  { canonical: "Linux" },
  { canonical: "Bash" },
  { canonical: "Jenkins" },
  { canonical: "GitHub Actions" },

  // Tools / practice
  { canonical: "Git" },
  { canonical: "GitHub" },
  { canonical: "GitLab" },
  { canonical: "Jira" },
  { canonical: "Agile" },
  { canonical: "Scrum" },
  { canonical: "Unit Testing", aliases: ["Jest", "PyTest", "JUnit"] },
  { canonical: "Microservices" },
  { canonical: "API Design" },
];

// Ambiguous words require a technical list/context, not ordinary prose.
const AMBIGUOUS = new Set(["C", "R", "Go", "Express", "Swift", "Spark", "REST", "ML", "TS", "JS"]);
function matches(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = needle === "C" ? "(?![a-zA-Z0-9+#])" : needle === "R" ? "(?![a-zA-Z0-9&])" : "(?![a-zA-Z0-9])";
  const pattern = new RegExp(`(?<![a-zA-Z0-9])${escaped}${tail}`, AMBIGUOUS.has(needle) ? "" : "i");
  if (!AMBIGUOUS.has(needle)) return pattern.test(text);
  return text.split(/\n/).some(line => pattern.test(line) && (
    /^\s*(skills|technologies|languages|stack)\s*:/i.test(line) ||
    /^\s*[\w.+#/-]+(?:\s*[,|]\s*[\w.+#/-]+)+\s*$/.test(line) ||
    new RegExp(`${escaped}\\s+(programming|language|developer|development|framework|API)\\b`).test(line)
  ));
}
export function mentionsSkill(text: string, canonical: string): boolean {
  const definition = SKILL_DEFINITIONS.find(skill => skill.canonical === canonical);
  return Boolean(definition && [definition.canonical, ...(definition.aliases || [])].some(needle => matches(text, needle)));
}
export function extractSkills(text: string): string[] {
  return SKILL_DEFINITIONS.filter(skill => mentionsSkill(text, skill.canonical)).map(skill => skill.canonical).sort();
}
