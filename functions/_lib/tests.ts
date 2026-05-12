import type { Track } from "./types";

export type QuestionKind = "mcq" | "short" | "sample";

export interface McqQuestion {
  id: string;
  kind: "mcq";
  prompt: string;
  context?: string;
  options: string[];
  correct: number; // 0-indexed
  points: number;
}

export interface ShortQuestion {
  id: string;
  kind: "short";
  prompt: string;
  context?: string;
  expected_keywords: string[];
  rubric: string;
  points: number;
}

export interface SampleQuestion {
  id: string;
  kind: "sample";
  prompt: string;
  context?: string;
  expected_keywords: string[];
  rubric: string;
  points: number;
  word_target?: number;
}

export type Question = McqQuestion | ShortQuestion | SampleQuestion;

export interface TestBank {
  track: Track;
  duration_minutes: number;
  pass_score: number;       // 0-100
  shortlist_score: number;  // 0-100
  questions: Question[];
}

// ---------- Track: light_judgment ----------
// 3 typo/citation/inconsistency + 3 clarity + 2 short-form rewrite + 2 sample-task.
const lightJudgment: TestBank = {
  track: "light_judgment",
  duration_minutes: 30,
  pass_score: 65,
  shortlist_score: 50,
  questions: [
    {
      id: "lj_typo_1",
      kind: "mcq",
      prompt: "Which sentence contains a typo?",
      options: [
        "The reciept was lost in the move.",
        "The receipt was lost in the move.",
        "The committee will reconvene tomorrow.",
        "Their proposal arrived on time.",
      ],
      correct: 0,
      points: 8,
    },
    {
      id: "lj_citation_1",
      kind: "mcq",
      prompt:
        'A paragraph cites: "A 2024 MIT study found that 73% of AI agents fail at multi-step tool use (Smith et al., 2018)." What is the citation error?',
      options: [
        "The year in the citation (2018) contradicts the year in the claim (2024).",
        "MIT studies are never citable.",
        "The percentage looks suspicious; we should reject the whole claim.",
        "Citations should use APA, not in-text.",
      ],
      correct: 0,
      points: 10,
    },
    {
      id: "lj_inconsistent_1",
      kind: "mcq",
      prompt:
        "A founder bio reads: \"Joined Stripe in 2015 as employee #200 and became VP of Product in 2014.\" What is the inconsistency?",
      options: [
        "The promotion year (2014) is before the join year (2015).",
        "Employee numbers are confidential.",
        "Stripe didn't have VPs in 2015.",
        "VP of Product isn't a real title.",
      ],
      correct: 0,
      points: 10,
    },
    {
      id: "lj_clarity_1",
      kind: "mcq",
      prompt: "Which version reads more clearly?",
      options: [
        "Utilization of this functionality enables the facilitation of expedited task completion.",
        "Use this feature to finish tasks faster.",
        "By means of leveraging this functionality, faster task completion is facilitated.",
        "The functionality, when utilized, results in faster completion timelines for tasks.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "lj_clarity_2",
      kind: "mcq",
      prompt: "Which paragraph opening is strongest?",
      options: [
        "In this paper we will be discussing some of the things that are important about how we think about AI safety as a problem.",
        "AI safety has one hard problem: getting an agent to do what you meant, not what you said.",
        "There are many considerations when it comes to thinking about the broad topic area known as AI safety.",
        "It is the case that AI safety is, in many respects, a topic that has many facets.",
      ],
      correct: 1,
      points: 10,
    },
    {
      id: "lj_clarity_3",
      kind: "mcq",
      prompt: "Pick the sentence that is hardest to misread:",
      options: [
        "Pay workers fairly when possible.",
        "When possible, pay workers fairly.",
        "Pay all workers no less than the minimum wage of the country they reside in.",
        "Workers, when possible and fair, should be paid.",
      ],
      correct: 2,
      points: 8,
    },
    {
      id: "lj_short_1",
      kind: "short",
      prompt:
        'The following sentence has a problem. In one or two sentences, name the problem AND propose a fix:\n\n"Our platform leverages AI to optimize the workflow for the user to be able to do more of the things they need to do."',
      expected_keywords: ["vague", "weasel", "specific", "concrete", "what", "verb", "filler", "leverages", "optimize"],
      rubric:
        "Looking for: identification of vague/weasel words (leverages, optimize, things they need to do) AND a concrete rewrite that names what the platform actually does.",
      points: 12,
    },
    {
      id: "lj_short_2",
      kind: "short",
      prompt:
        'The following claim has a logical issue. Name it in one or two sentences:\n\n"95% of our beta users said they would recommend the product. We surveyed 12 of our most enthusiastic early adopters."',
      expected_keywords: ["selection", "bias", "sample", "not representative", "cherry", "12", "small", "enthusiastic"],
      rubric:
        "Looking for: identification of selection bias / unrepresentative sample / small N. Bonus for naming the 12-person and 'enthusiastic' problem specifically.",
      points: 12,
    },
    {
      id: "lj_sample_1",
      kind: "sample",
      context:
        "Read the following paragraph and write a 50-word summary that preserves the key claim and the key caveat.\n\n" +
        '"InternsForAI is a marketplace that routes work from autonomous AI organizations to human workers. We pay $4-12/hour for trial work depending on track, in USDC or Wise. Workers earn a publicly attested reputation score across every AI org we onboard. Pay floors per country are enforced; the trial task is $2 regardless of geography."',
      prompt:
        "Write a 50-word summary preserving the key claim and the key caveat. Aim for 45-55 words. Be concrete; do not pad.",
      expected_keywords: ["marketplace", "AI", "workers", "$4", "$12", "USDC", "Wise", "trial", "$2", "reputation", "country"],
      rubric:
        "Looking for: the main claim (marketplace routes work from AI orgs to humans, pay $4-12/hr) AND a concrete caveat (e.g. $2 trial regardless of geography, or country floors enforced). Penalize padding, generic language, and >65 or <35 word counts.",
      points: 11,
      word_target: 50,
    },
    {
      id: "lj_sample_2",
      kind: "sample",
      context:
        "A junior writer drafted this 80-word product blurb:\n\n" +
        "\"InternsForAI is a revolutionary platform that empowers human workers by leveraging the power of cutting-edge artificial intelligence to deliver world-class outcomes at unbeatable price points. With our innovative approach, workers can unlock their full potential while AI organizations gain access to a vetted talent marketplace that scales. Join us today and be part of the future of work — where humans and AI thrive together in a symbiotic relationship that redefines what's possible.\"",
      prompt:
        "Write a tighter, more honest 50-word rewrite. Cut every weasel word.",
      expected_keywords: ["humans", "AI", "trial", "test", "concrete", "pay", "work", "$"],
      rubric:
        "Looking for: removal of weasel words (revolutionary, leverages, empowers, world-class, unbeatable, innovative, symbiotic, redefines, unlock), concrete claims, ~50 word count. Reward specific verbs and at least one concrete number or fact.",
      points: 11,
      word_target: 50,
    },
  ],
};

// ---------- Track: mechanical ----------
const mechanical: TestBank = {
  track: "mechanical",
  duration_minutes: 30,
  pass_score: 65,
  shortlist_score: 50,
  questions: [
    {
      id: "m_data_1",
      kind: "mcq",
      prompt: 'A row reads "Smith,John,M,1987-04-13,US,Software Engineer". Which field is the year of birth?',
      options: ["1st", "2nd", "3rd", "4th"],
      correct: 3,
      points: 8,
    },
    {
      id: "m_data_2",
      kind: "mcq",
      prompt: "Which of these dates is invalid (calendar-impossible)?",
      options: ["2024-02-29", "2023-02-29", "2024-04-30", "2024-12-31"],
      correct: 1,
      points: 8,
    },
    {
      id: "m_json_1",
      kind: "mcq",
      prompt: 'Which of these is valid JSON?',
      options: [
        '{name: "alice", age: 30}',
        '{"name": "alice", "age": 30,}',
        '{"name": "alice", "age": 30}',
        "{'name': 'alice', 'age': 30}",
      ],
      correct: 2,
      points: 8,
    },
    {
      id: "m_dup_1",
      kind: "mcq",
      prompt: "A list of 1000 email addresses contains duplicates. What's the FIRST step to find them?",
      options: [
        "Email each one and see which bounce.",
        "Sort the list alphabetically, then look for adjacent duplicates.",
        "Pick a random subset and check by hand.",
        "Ask the database admin.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "m_unit_1",
      kind: "mcq",
      prompt: "A spreadsheet has prices in 'USD' and 'cents' mixed in the same column. The safest fix:",
      options: [
        "Assume everything is dollars.",
        "Add a column labeled 'currency_unit' and normalize values to one unit.",
        "Delete the cents rows.",
        "Multiply everything by 100.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "m_consist_1",
      kind: "mcq",
      prompt: "Three rows have country values: 'United States', 'USA', 'U.S.'. The safest cleanup:",
      options: [
        "Leave them; they're all clear.",
        "Standardize to ISO-3166 country code 'US' across all rows.",
        "Standardize to 'United States of America' as the longest form.",
        "Delete the rows with abbreviations.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "m_short_1",
      kind: "short",
      prompt:
        'You receive a CSV with one row that reads:\n"Doe, Jane",jane@example.com,2024-01-15,2,USD,75.00\n\nIn one sentence, name the most likely issue if a downstream script splits on commas without quoting.',
      expected_keywords: ["quote", "comma", "name", "Doe", "Jane", "split", "field", "escape"],
      rubric:
        "Looking for: identification that the quoted comma in 'Doe, Jane' will be split into two fields by a naive comma split, causing field misalignment.",
      points: 12,
    },
    {
      id: "m_short_2",
      kind: "short",
      prompt:
        'A timestamp field contains a mix of "2024-01-15" and "01/15/2024" and "15-01-2024" and "1705276800". In one or two sentences, propose how to normalize.',
      expected_keywords: ["ISO", "8601", "UTC", "epoch", "detect", "format", "parse", "normalize", "timezone"],
      rubric:
        "Looking for: a clear normalization plan (typically: parse all formats, convert to ISO 8601 UTC). Bonus for naming epoch-seconds and ambiguity (01/15 could be DD/MM or MM/DD).",
      points: 12,
    },
    {
      id: "m_sample_1",
      kind: "sample",
      context:
        "Raw input:\n{name: 'Alice', age: 30, languages: ['en', 'fr',], 'address': {street: '123 main', 'city': 'paris'},}",
      prompt: "Rewrite as valid JSON (no comments, no trailing commas). Reply with just the JSON.",
      expected_keywords: ['"name"', '"age"', '"languages"', '"address"', '"street"', '"city"', '"Alice"', '"30"', '"paris"'],
      rubric:
        "Looking for: valid JSON syntax (double quotes on keys+strings, no trailing commas). Penalize trailing commas, single quotes, or unquoted keys.",
      points: 11,
    },
    {
      id: "m_sample_2",
      kind: "sample",
      context:
        "You have a list of customer records. Three have the same email but different display names: alice@x.com -> 'Alice', 'alice', 'A. Bramble'.",
      prompt:
        "In 50 words, describe how you would dedupe while preserving the most-trusted display name. Be concrete.",
      expected_keywords: ["email", "key", "longest", "most", "trusted", "merge", "manual", "review", "canonical"],
      rubric:
        "Looking for: a clear rule (e.g. canonical email is the key; pick longest or most-recent display name; flag for manual review). Penalize hand-wavy answers.",
      points: 11,
    },
  ],
};

// ---------- Track: heavy_judgment ----------
const heavyJudgment: TestBank = {
  track: "heavy_judgment",
  duration_minutes: 30,
  pass_score: 70,
  shortlist_score: 55,
  questions: [
    {
      id: "hj_voice_1",
      kind: "mcq",
      prompt: "Which sentence is in active voice?",
      options: [
        "The contract was signed by the lawyer.",
        "The lawyer signed the contract.",
        "Signing of the contract was completed.",
        "It was the contract that the lawyer signed.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "hj_tone_1",
      kind: "mcq",
      prompt: "Which version best fits a serious technical report?",
      options: [
        "Bummer — the model totally borked the eval.",
        "The model failed the evaluation; further analysis is required.",
        "RIP the model lol.",
        "The model, sadly, did not perform very well at all.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "hj_logic_1",
      kind: "mcq",
      prompt: 'An argument: "Every AI lab we know has had a breach. Therefore all AI labs will eventually be breached." What is the logical flaw?',
      options: [
        "It generalizes from a non-representative sample (the labs we know).",
        "It uses 'eventually', which is too long a timeframe.",
        "Nothing — the argument is sound.",
        "It conflates 'breach' with 'attack'.",
      ],
      correct: 0,
      points: 10,
    },
    {
      id: "hj_translate_1",
      kind: "mcq",
      prompt: 'Best English translation of the French idiom "Il pleut des cordes":',
      options: [
        "It is raining ropes.",
        "It is raining cats and dogs.",
        "The weather is bad.",
        "The strings are wet.",
      ],
      correct: 1,
      points: 10,
    },
    {
      id: "hj_short_1",
      kind: "short",
      prompt:
        'Copy-edit this single sentence for clarity AND tone (technical-but-friendly). Reply with the rewrite only.\n\n"At InternsForAI, we are super committed to the goal of empowering humans to be able to interact with the cutting-edge AI agents of tomorrow."',
      expected_keywords: ["humans", "AI", "trial", "test", "pay", "work", "specific"],
      rubric:
        "Looking for: removal of filler (super, cutting-edge, empower, of tomorrow); a concrete, action-led rewrite; reasonable length (under 25 words).",
      points: 12,
    },
    {
      id: "hj_sample_1",
      kind: "sample",
      context:
        "Longer source (180 words):\n" +
        '"The InternsForAI thesis rests on a simple observation: autonomous AI organizations exist now, in 2026, and they need human help with the work AI cannot do well yet. Translation, copy-editing, transcription, prospect research, qualitative judgment calls — these are not going away on a five-year horizon. What is going away is the assumption that this work has to be brokered through traditional employment relationships. We are building the marketplace that routes work from AI orgs to humans. The operator IS an AI org — we are eating our own dog food. Workers prove themselves on a 30-minute trial test, earn a publicly attested reputation, and get paid in USDC or Wise. Pay floors are enforced per country. The first wedge for us, this week, is light editorial QA on our own outputs and the outputs of the AI orgs we onboard. If you are a thoughtful native English reader with 4-8 hours a week, this is the right time to apply."',
      prompt:
        "Write a 100-word abstract that preserves the thesis AND the call-to-action. Aim for 95-110 words.",
      expected_keywords: ["AI", "marketplace", "humans", "trial", "test", "30", "minutes", "QA", "USDC", "Wise", "apply", "reputation", "pay"],
      rubric:
        "Looking for: thesis (AI orgs need humans for non-automatable work), mechanism (marketplace + trial test + attested reputation + pay), CTA (apply, current wedge: light QA). Penalize padding or omitting the CTA. Word count 90-115 acceptable.",
      points: 26,
      word_target: 100,
    },
    {
      id: "hj_sample_2",
      kind: "sample",
      context:
        "A 200-word paragraph from a draft post (intentionally messy):\n" +
        '"So basically what we are doing here at InternsforAI is we are connecting up the humans with the AI organizations because of the fact that the AI organizations they need humans to do certain things and so we are like the middleman in this transaction. We charge a percentage which is competitive in the industry I think. And we are paying out in USDC or Wise depending on the worker preference. The trial task is two dollars and we found that this is the right number because it is high enough that people take it seriously but low enough that we can afford to have a lot of false positives in the application process which we definitely do. Our goal is to get to a steady state of like a hundred active workers in like ninety days. We think we can do this because the demand from AI organizations is going to be very large in our view based on what we are seeing from our own usage patterns."',
      prompt:
        "Rewrite as a tight 120-130 word paragraph. Active voice. Cut filler. Keep all concrete numbers and claims.",
      expected_keywords: ["AI", "humans", "marketplace", "USDC", "Wise", "$2", "trial", "100", "workers", "90", "days", "active", "voice"],
      rubric:
        "Looking for: active voice, removed filler ('basically', 'I think', 'like'), kept ALL numbers ($2, 100 workers, 90 days, USDC/Wise), tight 120-130 word count.",
      points: 26,
      word_target: 125,
    },
  ],
};

// ---------- Track: specialized ----------
const specialized: TestBank = {
  track: "specialized",
  duration_minutes: 30,
  pass_score: 70,
  shortlist_score: 55,
  questions: [
    {
      id: "sp_code_1",
      kind: "mcq",
      prompt:
        'Which of these JS snippets has a subtle bug?\n\nA) `for (let i=0; i<arr.length; i++) total += arr[i];`\nB) `arr.forEach(x => total += x);`\nC) `let total = arr.reduce(0, (a,b) => a+b);`\nD) `let total = arr.reduce((a,b) => a+b, 0);`',
      options: ["A", "B", "C", "D"],
      correct: 2,
      points: 10,
    },
    {
      id: "sp_sec_1",
      kind: "mcq",
      prompt: 'A SQL query is built with `\"SELECT * FROM users WHERE name = \" + userInput`. The vulnerability is:',
      options: [
        "Cross-site scripting (XSS).",
        "SQL injection.",
        "Server-side request forgery (SSRF).",
        "Insecure deserialization.",
      ],
      correct: 1,
      points: 10,
    },
    {
      id: "sp_review_1",
      kind: "mcq",
      prompt: "In a code review, you spot a public API function with no input validation. Best response:",
      options: [
        "Approve; validation can come later.",
        "Reject; demand a complete redesign of the module.",
        "Request changes; suggest specific validation rules and (if possible) a test case.",
        "Ignore it; not your responsibility.",
      ],
      correct: 2,
      points: 8,
    },
    {
      id: "sp_design_1",
      kind: "mcq",
      prompt: "A landing page CTA button is light-gray text on a white background. Primary issue:",
      options: [
        "Color preference.",
        "Insufficient contrast; will fail WCAG AA and underperform on conversion.",
        "Font is too modern.",
        "The button needs a shadow.",
      ],
      correct: 1,
      points: 8,
    },
    {
      id: "sp_short_1",
      kind: "short",
      prompt:
        'In one or two sentences, identify the bug:\n\n```js\nfunction sum(nums) {\n  let total = 0;\n  for (let i = 0; i <= nums.length; i++) {\n    total += nums[i];\n  }\n  return total;\n}\n```',
      expected_keywords: ["off-by-one", "<=", "<", "length", "undefined", "NaN", "index", "boundary"],
      rubric:
        "Looking for: identification of the off-by-one error (i <= nums.length should be i < nums.length), and that the last iteration reads nums[length] which is undefined and yields NaN.",
      points: 12,
    },
    {
      id: "sp_short_2",
      kind: "short",
      prompt:
        'You receive a PR titled "small refactor" that changes 800 lines across 23 files. In one sentence, what is your first comment?',
      expected_keywords: ["split", "smaller", "review", "scope", "atomic", "PR", "decompose", "intent"],
      rubric:
        "Looking for: a polite request to split the PR into reviewable chunks, OR a request for clearer scope/intent. Reward specificity (e.g. 'split per file or per module').",
      points: 12,
    },
    {
      id: "sp_sample_1",
      kind: "sample",
      context:
        "A function:\n\n```python\ndef get_user(user_id):\n    user = db.query(f\"SELECT * FROM users WHERE id = {user_id}\")\n    return user\n```",
      prompt:
        "In 60-100 words, list the top three issues and what to fix. Be concrete.",
      expected_keywords: ["SQL", "injection", "parameter", "prepared", "error", "handling", "exception", "return", "validation", "type", "None", "null", "missing"],
      rubric:
        "Looking for: (1) SQL injection / parameterization, (2) error handling / no exception path, (3) at least one of: input validation, missing-user case, return type unclear. Penalize generic 'add tests' as the lead.",
      points: 20,
      word_target: 80,
    },
    {
      id: "sp_sample_2",
      kind: "sample",
      context:
        "You are writing release notes for a small SDK update that adds two new optional config flags (`retry_count`, `timeout_ms`) and fixes a bug where the client retried on 4xx errors.",
      prompt:
        "Write release notes in the 'Added / Changed / Fixed' format. Be precise; one bullet per section. Reply with just the notes.",
      expected_keywords: ["Added", "Changed", "Fixed", "retry_count", "timeout_ms", "4xx", "retry", "client"],
      rubric:
        "Looking for: standard 'Added/Changed/Fixed' headings, one accurate bullet per section, naming the config flag names and the 4xx bug correctly.",
      points: 20,
    },
  ],
};

// ---------- Track: domain_expert ----------
const domainExpert: TestBank = {
  track: "domain_expert",
  duration_minutes: 30,
  pass_score: 75,
  shortlist_score: 60,
  questions: [
    {
      id: "de_legal_1",
      kind: "mcq",
      prompt: "Under U.S. FLSA, an 'intern' must:",
      options: [
        "Receive at least federal minimum wage if the employer is the primary beneficiary.",
        "Never be paid.",
        "Always be paid by the hour, regardless of duties.",
        "Be a full-time student.",
      ],
      correct: 0,
      points: 10,
    },
    {
      id: "de_med_1",
      kind: "mcq",
      prompt: "A clinical study describes 'statistical significance at p < 0.05'. The correct interpretation:",
      options: [
        "There is a 95% chance the hypothesis is true.",
        "If the null hypothesis were true, there is less than a 5% chance of observing data this extreme.",
        "The effect size is large.",
        "The study is high quality.",
      ],
      correct: 1,
      points: 10,
    },
    {
      id: "de_fin_1",
      kind: "mcq",
      prompt: "A SAFE (Simple Agreement for Future Equity) is:",
      options: [
        "A debt instrument with interest.",
        "An agreement that converts to equity at a future priced round, often with valuation cap and/or discount.",
        "A direct purchase of common stock.",
        "A regulatory filing.",
      ],
      correct: 1,
      points: 10,
    },
    {
      id: "de_class_1",
      kind: "mcq",
      prompt: "Which fact most strongly supports independent-contractor (vs. employee) classification under the U.S. ABC test?",
      options: [
        "The worker is paid hourly.",
        "The worker provides similar services to other clients in a customarily independent trade.",
        "The worker uses the company's email address.",
        "The worker attends a weekly team meeting.",
      ],
      correct: 1,
      points: 10,
    },
    {
      id: "de_short_1",
      kind: "short",
      prompt:
        "A platform pays a worker located in Nigeria a flat $2 trial-task fee, then $0.50 per accepted micro-task. In one or two sentences, name the most material U.S.-side compliance question (not foreign law).",
      expected_keywords: ["1099", "1042", "W-8BEN", "tax", "withhold", "reporting", "foreign", "person", "FATCA", "OFAC", "sanctions"],
      rubric:
        "Looking for: U.S. tax/withholding question for foreign-person contractor (typically W-8BEN, 1042-S reporting, withholding rates) OR OFAC/sanctions screening. Penalize vague answers about 'compliance'.",
      points: 15,
    },
    {
      id: "de_sample_1",
      kind: "sample",
      context:
        "Scenario: A small marketplace pays workers per accepted task. Workers set their own hours, use their own equipment, and work for multiple platforms. The marketplace publishes per-task pay rates but rejects roughly 8% of submissions for quality reasons.",
      prompt:
        "In 100-150 words, write a paragraph for the platform's Terms of Service stating the classification clearly and acknowledging the rejection rate without creating employment indicia.",
      expected_keywords: ["independent", "contractor", "not", "employee", "not", "intern", "per-task", "rejection", "quality", "tax", "responsible", "FLSA"],
      rubric:
        "Looking for: clean independent-contractor language; explicit 'not an employee, not an FLSA intern'; worker pays own taxes; per-task pay model; quality-rejection mechanism described without supervision-of-the-work indicia.",
      points: 25,
      word_target: 125,
    },
    {
      id: "de_sample_2",
      kind: "sample",
      context:
        "A founder asks: 'Can we just call the workers interns and not pay them for the trial task to save money?'",
      prompt:
        "Reply in 80-120 words: name the legal risk (cite the relevant U.S. test framework by name) and propose a compliant alternative.",
      expected_keywords: ["FLSA", "primary", "beneficiary", "test", "DOL", "Glatt", "intern", "wage", "minimum", "trial", "$2", "paid"],
      rubric:
        "Looking for: cite the FLSA 'primary beneficiary' test (sometimes called the Glatt seven-factor test), flag misclassification risk, propose paying the trial task even if nominal. Penalize answers that don't name the test framework.",
      points: 20,
      word_target: 100,
    },
  ],
};

const BANKS: Record<Track, TestBank> = {
  light_judgment: lightJudgment,
  mechanical: mechanical,
  heavy_judgment: heavyJudgment,
  specialized: specialized,
  domain_expert: domainExpert,
};

export function getTestBank(track: Track): TestBank | null {
  return BANKS[track] || null;
}

// Returns a sanitized version of the bank (no correct answers / rubric / keywords)
// for delivery to the client. Server keeps the full bank for scoring.
export function publicTestBank(track: Track): TestBank | null {
  const bank = getTestBank(track);
  if (!bank) return null;
  return {
    ...bank,
    questions: bank.questions.map((q) => {
      if (q.kind === "mcq") {
        return { id: q.id, kind: q.kind, prompt: q.prompt, options: q.options, points: q.points, correct: -1 } as McqQuestion;
      }
      if (q.kind === "short") {
        return { id: q.id, kind: q.kind, prompt: q.prompt, context: q.context, expected_keywords: [], rubric: "", points: q.points } as ShortQuestion;
      }
      return { id: q.id, kind: q.kind, prompt: q.prompt, context: q.context, expected_keywords: [], rubric: "", points: q.points, word_target: q.word_target } as SampleQuestion;
    }),
  };
}
