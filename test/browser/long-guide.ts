export const longGuide = `# A practical guide to Markdown

Markdown lets you write clear documents without a complicated editor. This guide demonstrates formatting for a project handbook, including nested emphasis, structured lists, tables, quotations, and examples you can copy into your own notes.

## Emphasis and readable paragraphs

Use **bold text for important decisions**, *italics for gentle emphasis*, and **nested bold with *italic details* and \`inline code\`** when describing a command. A paragraph should explain one idea thoroughly, rather than hiding the context behind a collection of headings. Keep punctuation beside the phrase it belongs to and separate unrelated ideas with blank lines.

Here is a longer explanation: documentation works best when readers can understand the purpose before studying the implementation. Describe the problem, identify the constraints, and show a concrete example. Links such as [the Markdown reference][reference] can point to supporting material without interrupting the surrounding explanation.

## Lists with detail

- **Plan the document carefully.** Start with the questions your audience actually asks.
  Continue the explanation on another line so the rationale remains connected to the original recommendation.

  A second paragraph adds background for a loose list item. It should remain visible when the next list item arrives, even when the renderer changes the earlier item's structure.

  - **Identify the audience** and *their existing knowledge*.
    Write a small example that explains terminology before introducing exceptions.
  - **Choose a useful outline** with sections that tell a coherent story.
    Include a summary for readers who only need the essential result.

- **Review the details.** Verify examples against the actual project rather than relying on memory.

  Check the output, compare assumptions, and record any limitations discovered during review.

- **Publish and maintain the result.** Assign someone to revisit the guide after major releases.

## A numbered workflow

1. Read the requirement and describe the intended outcome in plain language.

   Keep this explanation with the first step so future readers understand why it matters.

2. Prepare a small working example with realistic input and observable output.
   - Verify the ordinary path before trying unusual cases.
   - Record the expected behavior before changing the implementation.
3. Run the example, examine the result, and summarize the remaining tradeoffs.

## Quotations and links

> Good documentation does more than describe syntax. It connects a reader's immediate question to a useful next action.
>
> **Remember the context:** a recommendation without an explanation is difficult to apply confidently.
>
> - Keep the example small enough to understand.
> - Explain what changes when the surrounding conditions differ.

Visit [the project website](https://example.com/docs) for background, or consult [the Markdown reference][reference] after finishing this walkthrough. Reference links are especially convenient in long documents because their destinations can be maintained in one place.

## A comparison table

The following table begins as an ordinary line of text until its delimiter arrives. Its header must not disappear just because Markdown discovers that the content belongs inside a table.

| Feature | Purpose | Example |
| :--- | :---: | ---: |
| Emphasis | Highlight a key recommendation | **Read carefully** |
| Inline code | Name a command or variable | \`build\` |
| Links | Connect supporting material | [Documentation][reference] |
| Lists | Organize related tasks | Plan, verify, publish |

Tables should compare a few meaningful properties rather than squeezing an entire report into narrow columns. Follow the table with an explanation of what the comparison means for your reader.

## Code examples

A JavaScript example demonstrates a simple transformation:

\`\`\`javascript
const tasks = ["plan", "verify", "publish"];
const completed = tasks.map((task, index) => ({
  task,
  order: index + 1,
  ready: true,
}));
console.log(completed);
\`\`\`

The surrounding explanation describes the input and the result. Code blocks should preserve spacing while the prose continues to arrive.

A Python example illustrates the same idea with a different language:

\`\`\`python
def summarize(tasks):
    return [f"{index + 1}. {task}" for index, task in enumerate(tasks)]

for line in summarize(["plan", "verify", "publish"]):
    print(line)
\`\`\`

## Final recommendations

Write complete sentences, give each section a clear purpose, and test every example. A guide can be both precise and welcoming when it anticipates questions rather than merely listing features. Add a footnote for supporting context[^context] without distracting from the main argument.

---

### Review checklist

- [x] Explain the goal before presenting syntax.
- [x] Include realistic examples and meaningful comparisons.
- [ ] Revisit the guide when requirements change.

**The final takeaway:** formatting serves understanding. Choose the simplest structure that communicates the information clearly, and make sure the details remain readable as the document grows.

[reference]: https://commonmark.org/help/

[^context]: Supporting notes may appear later in the document, changing earlier links without changing the reader's place in the explanation.
`;
