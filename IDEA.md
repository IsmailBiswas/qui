# Stop It Bro — Contextual AI Learning Assistant

## The Problem

When a student asks an AI a question, the answer often contains **multiple related concepts** that the student doesn't understand either. Today's chat UIs force a painful tradeoff:

1. **Context drift** — Asking about a related concept shifts the AI's context away from the main topic. Follow-up answers start referencing the side-topic instead of the original one.
2. **Lost position** — The student has to scroll back through a growing chat to re-read the original answer, breaking their flow.
3. **Accumulated noise** — Each follow-up question about the answer adds to the conversation context, polluting future responses with irrelevant prior sub-questions.

## The Idea

A **Tauri desktop app** that connects to any AI provider API and offers a fundamentally different UX for learning from AI answers.

### Core Concept: Anchored Q&A

The user asks a **main question**. The AI responds with the **first answer**. This answer becomes an **anchor** — a fixed, always-visible reference that the user can interrogate without leaving or losing it.

```
┌─────────────────────────────────────┐
│  Main Question                      │
├─────────────────────────────────────┤
│                                     │
│  First Answer (anchored)            │
│  ┌───────────┐ ┌───────────┐       │
│  │ concept A │ │ concept B │ ...   │
│  └─────┬─────┘ └─────┬─────┘       │
│        │              │             │
│        ▼              ▼             │
│   Sub-Q&A panel   Sub-Q&A panel    │
│                                     │
└─────────────────────────────────────┘
```

### UX / UI Behaviour

- The **first answer stays pinned and visible** at all times while the user explores sub-questions.
- Users can select or reference any part of the answer and ask a question about it — opening a **sub-Q&A panel** attached to that section.
- Multiple sub-Q&A panels can exist independently, each tied to a different part of the answer.
- Sub-panels can be opened, collapsed, or dismissed without affecting the anchor or other panels.

### Context Management (The Key Differentiator)

Every sub-question sent to the AI is constructed with a **strict, isolated context window**:

| Message | Role |
|---|---|
| The original first answer | `system` / `context` |
| The user's sub-question about the answer | `user` |

**That's it.** No prior sub-questions. No accumulated follow-ups. Each sub-question is a **fresh, independent query anchored only to the original answer**.

This means:
- Asking about *Concept A* does **not** pollute the context when later asking about *Concept B*.
- The AI always interprets the sub-question **in the context of the original answer**, never drifting.
- The student gets precise, focused explanations every time.

### Example Flow

1. **Student asks:** "How does photosynthesis work?"
2. **AI answers** with a detailed explanation mentioning *chlorophyll*, *ATP*, *Calvin cycle*, *light-dependent reactions*, etc.
3. Student doesn't know what ATP is → clicks/selects "ATP" in the answer → types: "What is ATP and why is it needed here?"
4. **AI receives context:** `[Original photosynthesis answer]` + `"What is ATP and why is it needed here?"`
5. Student also doesn't know about the Calvin cycle → clicks "Calvin cycle" → types: "Break down the Calvin cycle simply"
6. **AI receives context:** `[Original photosynthesis answer]` + `"Break down the Calvin cycle simply"` — **no mention of the ATP sub-question**.

Both sub-answers appear in their own panels, visually attached to the relevant parts of the original answer.

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | **Tauri v2** (Rust backend, lightweight webview) |
| Frontend | TBD (React / Svelte / Solid) |
| AI Provider | Pluggable — OpenAI, Anthropic, Ollama, etc. via a unified adapter |
| State | Local conversation trees stored as JSON / SQLite |

## MVP Scope

- [ ] Single AI provider integration (e.g., OpenAI chat completions)
- [ ] Main question → anchored first answer
- [ ] Ability to ask sub-questions on selected text in the answer
- [ ] Isolated context per sub-question (original answer + sub-question only)
- [ ] Sub-Q&A panels displayed inline or as side panels
- [ ] Collapse / expand / dismiss sub-panels
- [ ] Conversation persistence (local storage)

## Future Ideas

- Recursive depth — ask sub-questions on sub-answers (tree of understanding)
- Visual concept map generated from the Q&A tree
- Export a learning session as structured notes
- Highlight which parts of the answer have been explored vs. not
- Multiple AI provider support with hot-switching
- Shared sessions — send a learning tree to a friend or teacher
