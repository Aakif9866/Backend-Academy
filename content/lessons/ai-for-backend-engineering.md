---
title: Using AI Effectively for Backend Engineering
summary: A 12-step AI-assisted workflow, prompt templates, failure modes, security for both AI-assisted development and LLM-powered apps, verification checklists, context engineering and testing.
difficulty: intermediate
minutes: 80
source: backend/18-using-ai-for-backend-engineering.md
prerequisites: [backend-architecture-layers, web-vulnerabilities]
objectives:
  - Use AI across the lifecycle without handing it authority
  - Write prompts with requirements, constraints and acceptance criteria
  - Recognise typical AI failure modes in backend code
  - Apply a verification checklist before accepting generated code
videos:
  - id: zjkBMFhNj_g
    title: "[1hr Talk] Intro to Large Language Models"
    channel: Andrej Karpathy
    why: Understanding what an LLM is (and why it confidently invents things) makes the failure modes in section 4 intuitive.
resources:
  - url: https://genai.owasp.org/llm-top-10/
    title: OWASP Top 10 for LLM Applications
    why: The reference list of LLM-specific risks, such as prompt injection and excessive agency, cited in section 5.
  - url: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
    title: OWASP API Security Top 10 (2023)
    why: The API risks AI-generated endpoints most often reintroduce, such as broken object-level authorisation.
quiz:
  - type: code
    q: An AI assistant generated this endpoint. What is the critical flaw?
    code: |
      app.get('/api/invoices/:id', requireLogin, async (req, res) => {
        const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
        res.json(invoice);
      });
    options: ["It should use POST", "Broken object-level authorisation: any logged-in user can read any invoice by id", "findUnique is slow", "It lacks a try/catch for JSON"]
    answer: 1
    explain: "Login is checked but ownership isn't. The query must scope by the caller (for example `where: { id, orgId: req.user.orgId }`). This is API1:2023 in the OWASP API Top 10, and a very common AI-generated bug."
  - type: tf
    q: If AI-generated code compiles and its AI-generated tests pass, it is correct.
    answer: 1
    explain: False. Tests written by the same model often encode the same misunderstanding. Verify against requirements, add your own edge-case tests, and review security-sensitive paths by hand.
  - type: mcq
    q: Why does "here's the whole repo, improve it" tend to produce poor results?
    options: ["Repos are too small", "No clear task, constraints or acceptance criteria, so the model guesses what 'better' means and touches too much", "AI can't read code", "It's against terms of service"]
    answer: 1
    explain: Focused tasks with relevant context and explicit acceptance criteria produce reviewable, correct changes. Vague requests produce sprawling diffs.
---

## Hands-on exercise

Take one endpoint from a previous project. Ask an AI assistant to add a feature to it using the context template from section 8 (task, context, constraints, acceptance criteria, output). Then review the result with the verification checklist from section 6 and write down every issue you found, including ones you had to fix by hand.

## Completion criteria

- You can write a structured prompt for a backend change.
- You review AI output with a checklist and catch authorisation, validation and error-handling gaps.
