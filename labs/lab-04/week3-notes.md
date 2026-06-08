# Lab 2: ACE Flashcard Generator

## Overview

This week we're learning about prompt engineering techniques to make LLM outputs more reliable and consistent. To practice these skills, you will build a CLI tool called `flashcards` that converts course notes into study flashcards using a custom format.

Your `flashcards` tool will accept a text file with notes from any course (e.g., Markdown, HTML, or copy/pasted from Word/PDF), apply prompt engineering techniques from [this week's notes](../../weeks/week-03/README.md), and generate study flashcards in a specific format that requires understanding, not just memorization.

The focus of this lab is **prompt engineering**, not complex code. You will spend most of your time iterating on the text of your system prompt, testing different approaches, and refining your instructions until the output is consistently correct.

Your primary programming language this week will be English and Markdown!

## 1. ACE Flashcard Format

There are many popular formats for creating flashcards (e.g., [Anki](https://apps.ankiweb.net/)), but we're going to work with our own imaginary format, **ACE (Application, Challenge, Evidence)**. We'll use this custom format so that we don't rely on the training data of the model (i.e., LLMs already know a lot about the Anki format).

Each ACE flashcard MUST follow this exact structure:

```text
=== CARD [number] ===
APPLICATION: [1-2 sentence real-world workplace task where this concept is needed]
CHALLENGE: [A specific problem to solve in the scenario. Expand all acronyms]
ANSWER: [Correct solution with brief explanation]
EVIDENCE: "[Direct quote from source notes supporting this card]"
MISCONCEPTION: "[Quote of what a junior developer/student might incorrectly believe]"
CORRECTION: [Why it's wrong, citing the notes]
===
```

**Example:**

```text
=== CARD 1 ===
APPLICATION: Your team lead asks you to optimize a React dashboard that
feels sluggish when switching between tabs, and you notice child
components re-render even when their data hasn't changed.
CHALLENGE: Which React feature would you apply to prevent a functional
component from re-rendering when its props remain the same?
ANSWER: Wrap the component with React.memo(), a higher-order component
that performs a shallow comparison of props and skips re-rendering if
they haven't changed.
EVIDENCE: "React.memo is a higher order component that memoizes your
component. It will only re-render if the props have changed."
MISCONCEPTION: "I'd use useMemo() to memoize the whole component so
it doesn't re-render."
CORRECTION: useMemo() memoizes computed values within a component, not
the component itself. React.memo() is the correct tool for component-level
memoization as described in the notes.
===
```

Because we're using a non-standard format, we'll need to teach the model how to generate it through careful prompt engineering. It won't be enough to say, "Make me 5 flashcards," since that would leave too much up to the model's judgement.

> [!NOTE]
> It's common to have to work with custom formats when prompting LLMs, and being able to describe and provide the right examples to teach the model how to do something new (i.e., never seen in training data) is a key outcome of prompt engineering.

### Additional ACE Content Constraints

In addition to the _format_ of the flashcards, we also require the _content_ to adhere to a number of guidelines:

1. **No Hallucinations**: Cards MUST ONLY be based on actual content from the provided notes. The model must not invent information, examples, or concepts not present in the source material.

2. **Direct References**: Each card MUST include a direct quote from the notes that supports the question and answer. This must also not be hallucinated.

3. **Expanded Acronyms**: All acronyms in the CHALLENGE field MUST be expanded (e.g., "Application Programming Interface (API)" not just "API").

4. **Authentic Student Voice**: The MISCONCEPTION must be phrased as a direct quote from a confused student, not a general statement about what students do wrong.

> [!NOTE]
> Getting the LLM to format responses is one thing; but we also usually need to use prompt engineering to produce the right content, tone, and style. This takes practice

## 2. The Stack

- **Language:** Python or Node.js/TypeScript (or whatever you want)
- **AI Provider:** [OpenRouter.ai](https://openrouter.ai) using your API Key
- **Libraries:** Official `openai` SDK or the OpenRouter SDK ([JavaScript](https://openrouter.ai/docs/quickstart), [Python](https://openrouter.ai/docs/sdks/python/overview)), `dotenv`/`python-dotenv`

### Model Suggestions

For your LLM model choice, you are encouraged to do some experimentation. Your goal is to optimize the value you receive for the money you spend. We could decide to use the most powerful models available right now; but doing so would mean we have to spend more money.

> [!TIP]
> To understand exactly how much money you are spending with each chat completion, see the sample code in [cost.js](./cost.js) and [cost.py](./cost.py). OpenRouter provides pricing info for models, and includes token usage with all completion responses.

An alternative approach is to see how far we can push a cheaper model to behave the way we want through prompt engineering. For example, we might be able to do this labe entirely using free or very inexpensive models. Thinking about cost is always part of programming LLMs.

Consider using a cheaper model trained for instruction following. For example, Meta's `meta-llama/llama-3.3-70b-instruct:free` (free version) or, if you get rate limited, the paid version `meta-llama/llama-3.3-70b-instruct` ($0.10/M input tokens, $0.32/M output tokens). You could write code to try with the free version first, then fallback to the paid version if the initial requests fails with a `429` rate-limit error.

You are also welcome to experiment with [other models (free or non-free)](https://openrouter.ai/models), but avoid using the really large/expensive models for this exercise, unless it's just to compare the differences with your prompt. You shouldn't need a big/expensive model for this task.

> [!NOTE]
> Depending on the length of your notes, you may need to pick a model with a larger **context** (i.e., the number of tokens it can process at once). The [OpenRouter Models page](https://openrouter.ai/models) lets you filter models by cost, context length, and other parameters.

## 3. Required Prompt Engineering Techniques

The **system prompt** MUST incorporate the following techniques from [this week's notes](../../weeks/week-03/README.md). However, **you are responsible for determining how to implement them**.

### 3.1 Separation of Code and Prompts

In this lab, your system prompt MUST be **static** (i.e., instructions that are always the same) and will end-up being quite long. In such cases, it's common to separate your prompt from your code. We'll put our system prompt in a Markdown file named `SYSTEM_PROMPT.md` and have the `flashcards` program read it on startup. Doing so will make it easier to iterate on it vs. trying to do everything using strings in code.

### 3.2 Delimiters for Input Notes

The **user prompt** will be **dynamic** (i.e., it will include different inputs each time) and include external information, arguments, etc. Use proper delimiters (XML tags or Markdown code blocks) to clearly separate the user's course notes from other instructions. This helps to prevent **prompt injection** and helps the model distinguish between instructions and data.

> [!NOTE]
> Without clear delimiters, the model may confuse user data with instructions, or users could inject malicious prompts. We want to avoid both.

### 3.3 Few-Shot Prompting

We need to include example flashcards in the system prompt to teach the model the exact format. You should develop these examples through iteration with the model (i.e., you don't need to write them by hand):

1. Start with a zero-shot prompt (no examples)
2. Generate some cards and see what works well
3. Edit the good responses to create useful examples for the model
4. Consider both common cases **and** edge cases
5. Add them to your system prompt as few-shot examples

### 3.4 Chain-of-Thought Reasoning

Instruct the model to think _step-by-step_ before generating cards. This should include sufficient information for it to reason, for example:

- Analyzing whether the notes contain sufficient information
- Verifying that each card's content actually appears in the notes
- Reasoning about what common mistakes students might make
- etc.

### 3.5 Structured Reasoning Workflow

Define a clear _workflow_ for the model to follow. Consider what steps the model should take:

- How should it analyze the input notes?
- How should it verify information before including it?
- How should it check its own work?
- etc.

> [!TIP]
> Consider how would you ask an employee to do this task manually? What steps would they follow, and what information would they require?

### 3.6 Edge Case Handling

Include instructions for what to do if:

- The notes are insufficient, empty, or not useful for generating flashcards
- The notes don't contain enough information for the requested number of cards
- The content is unclear or ambiguous
- etc.

The model should respond with helpful guidance rather than generating poor-quality cards or hallucinated content.

> [!NOTE]
> Real-world inputs are messy. Your tool needs to handle failure gracefully. Also, your model will **always** respond with something, and we want that response to be useful in all cases.

## 4. Step-by-Step Instructions

### Step 1: Setup

1. Create a folder in your aip444 monorepo: `labs/lab-02/`
2. Ensure your `.env` file has the `OPENROUTER_API_KEY=sk-...`
3. Setup dependencies (same as Lab 1)
4. Create your script file: `flashcards.js` or `flashcards.py`
5. Create your system prompt file: `SYSTEM_PROMPT.md`
6. **Identity Header:** Print your student info header (same as Lab 1)
7. **API Key Validation:** Load and validate the API key (same as Lab 1)

### Step 2: Command Line Arguments

Your script must accept two arguments:

```bash
# Python
python flashcards.py path/to/notes.md --cards 3

# Node.js
node flashcards.js path/to/notes.md --cards 3
```

1. First argument: the `path` to a Markdown, HTML, or text file containing course notes (if you want to support passing URLs to download public course notes, that's a useful feature, though not required).
   - If the file path is missing or the file doesn't exist, print an error and exit

2. `--cards N`: number of flashcards to generate (minimum 1, maximum 5)
   - If `--cards` is missing, default to 3
   - If `--cards` is outside the 1-5 range, print an error and exit

**Python example:**

```python
import argparse
import sys

def parse_arguments():
    parser = argparse.ArgumentParser(
        description='Generate ACE flashcards from course notes'
    )
    parser.add_argument(
        'notes_path',
        help='Path to the notes file (Markdown, HTML, or text)'
    )
    parser.add_argument(
        '--cards',
        type=int,
        default=3,
        help='Number of flashcards to generate (1-5, default: 3)'
    )

    args = parser.parse_args()

    # Validate cards range
    if args.cards < 1 or args.cards > 5:
        parser.error('--cards must be between 1 and 5')

    return args

# Usage
args = parse_arguments()
notes_path = args.notes_path
cards = args.cards
```

**Node.js example:**

```javascript
const { parseArgs } = require('node:util');

function parseArguments() {
  const options = {
    cards: {
      type: 'string',
      short: 'c',
      default: '3',
    },
  };

  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ options, allowPositionals: true }));
  } catch (err) {
    console.error('❌ Error parsing arguments:', err.message);
    process.exit(1);
  }

  // Check for notes path
  if (positionals.length === 0) {
    console.error('❌ Error: Please provide a path to notes file');
    console.error('Usage: node flashcards.js <notes-path> [--cards N]');
    process.exit(1);
  }

  const notesPath = positionals[0];
  const cards = parseInt(values.cards);

  // Validate cards range
  if (isNaN(cards) || cards < 1 || cards > 5) {
    console.error('❌ Error: --cards must be between 1 and 5');
    process.exit(1);
  }

  return { notesPath, cards };
}

// Usage
const { notesPath, cards } = parseArguments();
```

### Step 3: Read the SYSTEM_PROMPT.md and Notes File

On startup, the program needs to read two files into strings:

1. your system prompt, `SYSTEM_PROMPT.md`
2. the course notes defined in the `path` argument

**For initial testing and development**, use [this week's notes](../../weeks/week-03/README.md) as your input file. This ensures that you are working with content you understand well and that you can verify the accuracy of generated cards. It also lets you compare output to other student's tools.

**After your prompt is working reliably** with this week's notes, you'll test with notes from other courses to ensure your prompt generalizes well.

If either file doesn't exist or can't be read, print an error and exit.

**Node.js:**

```javascript
const { readFile } = require('node:fs/promises');

async function getFileContents(path, description) {
  try {
    return await readFile(path, 'utf-8');
  } catch (err) {
    console.error(`❌ Error: ${description} not found: ${path}`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

// Usage (in async function)
const systemPrompt = await getFileContents('SYSTEM_PROMPT.md', 'System prompt file');
const notesContent = await getFileContents(notesPath, 'Notes file');
```

**Python:**

```python
def get_file_contents(path, description):
    """Read a file and return its contents, or exit on error."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ Error: {description} not found: {path}")
        sys.exit(1)
    except Exception as err:
        print(f"❌ Error reading {description}: {path}")
        print(f"   {err}")
        sys.exit(1)

# Usage
system_prompt = get_file_contents('SYSTEM_PROMPT.md', 'System prompt file')
notes_content = get_file_contents(notes_path, 'Notes file')
```

### Step 4: Write Your System Prompt

> [!IMPORTANT]
> Save your initial system prompt before you start iterating, since you need to submit that and show how it has evolved during the lab and your testing.

This is the core of the lab. The bulk of your time should be spent designing a system prompt that:

1. **Defines the role** - What is the AI's purpose in this interaction?
2. **Explains the task** - What should it do with the notes?
3. **Specifies the format** - What does an ACE card look like?
4. **Prevents hallucination** - How do you ensure cards are grounded in the notes?
5. **Handles edge cases** - What should happen when notes are insufficient or something else goes wrong?
6. **Includes examples** - What do good cards look like?
7. **Defines a reasoning workflow** - What steps should the model follow?

Your system prompt will need to be written carefully in order to address a number of challenges:

- **Hallucination Prevention**: The model must verify that information exists in the notes before including it in a card
- **Reference Accuracy**: Each REFERENCE must be a real, direct quote from the notes
- **Acronym Expansion**: The model must expand all acronyms in the QUESTION
- **Student Voice**: COMMON MISTAKE must sound like a real student quote, not a textbook description
- **Grounding**: All content must trace back to the original source notes (i.e. it must be _grounded_ in the notes)

You are free to create the system prompt however you like, but here is a recommended approach:

1. Start with a simple zero-shot prompt (i.e., limited guidance, see how the model does)
2. Test it and observe failures (i.e. where do you need to add more instructions or clarify things?)
3. Add chain-of-thought instructions
4. Add few-shot examples based on good outputs you've already observed in testing
5. Add verification steps to prevent hallucination
6. Iterate until results are reliable

As you begin, ask yourself some questions:

- Should the model generate its reasoning before or after the cards?
- How can you instruct the model to verify information against the notes?
- Which examples will best teach the format?
- How do you enforce the "no hallucination" rule?

### Step 5: Build the User Prompt

The user prompt, unlike the system prompt, will always be different. It needs to:

1. Include the delimiter-wrapped notes content
2. Specify how many cards to generate
3. Repeat and reinforce the critical instructions

> [!TIP]
> As the size of your instructions and context data increase, it's easy for the model to ignore or forget things you told it earlier. Therefore, it's a good idea to give your instructions at the start and then repeat them again at the end, so the model is clear on the task.

### Step 6: Make the API Call

Use the OpenAI SDK or OpenRouter SDK to do a chat completion with OpenRouter, just as you did in lab 1.

### Step 7: Extract and Display the Cards

The model's response will likely include reasoning/thinking/explanation. This is good, since the extra reasoning helps the model generate better cards. You have two options for handling this extra text:

**Option A**: Let the model include reasoning, then extract only the cards for display. This preserves the model's context, while showing users just the final output.

**Option B**: Instruct the model to put all reasoning before the cards, then extract everything after a specific delimiter.

For this lab, **Option A is recommended** because it's more robust across different model behaviours. However, it requires us to post-process the output:

1. Find all occurrences of `=== CARD` in the output
2. Extract each complete card (from `=== CARD N ===` to the ending `===`)
3. Print each card

**Python example:**

```python
import re

# Extract all cards using regex
cards = re.findall(
    r'(=== CARD \d+ ===.*?===)',
    output,
    re.DOTALL
)

if not cards:
    print("❌ No cards found in output.")
    sys.exit(1)

print(f"\n✅ Generated {len(cards)} flashcard(s):\n")
for card in cards:
    print(card)
    print()  # blank line between cards
```

**Node.js example:**

```javascript
// Extract all cards using regex
const cardRegex = /=== CARD \d+ ===.*?===/gs;
const cards = output.match(cardRegex);

if (!cards) {
  console.log('❌ No cards found in output.');
  process.exit(1);
}

console.log(`\n✅ Generated ${cards.length} flashcard(s):\n`);
cards.forEach((card) => {
  console.log(card);
  console.log(); // blank line
});
```

### Step 8: Test with Edge Cases

We need to make sure that both our code, and the prompts, will handle various edge cases. To do so, we'll create test files to verify your edge case handling:

#### Test 1: Empty notes

```bash
echo "# Empty Notes" > test-empty.md
python flashcards.py test-empty.md --cards 2
```

#### Test 2: Insufficient content

```bash
echo "React is a JavaScript library." > test-minimal.md
python flashcards.py test-minimal.md --cards 3
```

The model should respond with helpful error messages, **not** generate poor-quality or hallucinated cards. You'll need to give the model some guidance on what the errors should say.

### Step 9: Iterate on Your Prompt with Real Data

Now comes the real work. We'll use the following testing progression:

1. **Week 3 Notes (Initial)**: Start by perfecting your prompt using [this week's notes](../../weeks/week-03/README.md). Since you're already thinking about this content, it will make it easier to verify accuracy and catch hallucinations.

2. **Second Course**: Once reliable with the Week 3 notes, test with notes from another course you're taking this term. Download or copy the weekly notes and create a test file.

3. **Third Course**: Test with notes from yet another course to ensure that your prompt generalizes across different subjects and writing styles. Ideally, pick a very different course to the other two.

For each course's notes, observe:

- Are the cards in the correct format?
- Are the REFERENCE fields actual quotes from the notes?
- Are acronyms expanded in QUESTION fields?
- Do COMMON MISTAKE fields sound like student quotes?
- Is the model hallucinating information not in the notes?
- Does it handle edge cases properly?

You may find that your system prompt is too specific to the original notes you tested. For example:

- Programming course notes might have different structure than business course notes
- Some courses use more acronyms than others
- Technical depth varies significantly across subjects

Document what problems arose with each new course's notes and how you adjusted your `SYSTEM_PROMPT.md` to handle them. It will be rare for everything to be perfect, and likely you'll experience format or content issues.

Keep iterating on your `SYSTEM_PROMPT.md` file to solve as many problems as you can.

### Step 10: Finalize and Test

Once your prompts can reliably generates good cards:

1. Test with notes from 2-3 more courses
2. Test with `--cards 1`, `--cards 3`, and `--cards 5`
3. Test with edge cases (empty file, minimal content)
4. Verify the extraction code works for all counts
5. Verify REFERENCE fields are real quotes
6. Verify acronyms are expanded
7. Verify no hallucination occurs

## 5. Submission & Grading

Before submitting, verify that your tool passes these tests:

- [ ] Generates correct format with Week 3 notes (`--cards 3`)
- [ ] Generates correct format with notes from 2 other courses
- [ ] Works with `--cards 1`, `--cards 3`, and `--cards 5`
- [ ] Handles an empty notes file gracefully
- [ ] Handles minimal content in the notes gracefully
- [ ] All REFERENCE fields contain actual quotes from source notes
- [ ] All acronyms in QUESTION fields are expanded, if present
- [ ] All COMMON MISTAKE fields use student voice (quoted speech)
- [ ] No hallucinated information appears in any cards
- [ ] Extraction code successfully finds all generated cards

Create a document (Word or PDF) and submit it to Blackboard with the following sections:

### 1: GitHub URL for Code

_Paste the URL to your lab's code in your GitHub repo. Make sure your professor has been invited as a collaborator._

### 2: Initial System Prompt

_Paste your **initial/first version** of the system prompt (before iteration). This should be your zero-shot or minimal starting point._

### 3: Final System Prompt

_Paste your **final/production version** of the system prompt (after iteration and testing)._

### 4: Reflection on Prompt Changes

_Write about what you changed between your initial and final prompts. Discuss things like:_

- _What didn't work in your initial prompt?_
- _What specific techniques did you add (few-shot examples, chain-of-thought, verification steps, etc.)?_
- _How did you develop your few-shot examples?_
- _How did you prevent hallucination and ensure grounding in the source notes?_
- _How did you handle the REFERENCE and COMMON MISTAKE requirements?_
- _What edge cases did you discover and how did you handle them?_
- _What surprised you about the iteration process?_

### 5: Proof of Working Tool

_Screenshot of your terminal showing:_

1. _Your Name/ID header_
2. _The command you ran (with a real notes file and `--cards 3`)_
3. _The generated flashcards in correct ACE format_
4. _Evidence that REFERENCE fields contain real quotes_
5. _Evidence that acronyms are expanded in QUESTION fields (if any were used)_
6. _Evidence that COMMON MISTAKE uses student voice_

### 6: Proof of Edge Case Handling

_Screenshot of your terminal showing:_

1. _Your Name/ID header_
2. _The command you ran with an empty or minimal notes file_
3. _The model's helpful error message (not poorly generated or hallucinated cards)_
