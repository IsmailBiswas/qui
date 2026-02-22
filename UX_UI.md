# UX / UI Layout

## Window Layout

```
┌──────────────┬──────────────────────────────────┬─────────────┐
│  3D Graph    │                                  │             │
│  View        │                                  │             │
│  (rotate/    │                                  │  2D Thread  │
│   zoom/pan)  │                                  │  List View  │
│──────────────│       Explanation / Answer       │             │
│              │       (anchored, scrollable)     │ collapsible │
│  Main Node   │                                  │  list of    │
│              │                                  │  sub-Q&As   │
│              │                                  │             │
│              │                                  │             │
│              │                                  │             │
│              │                                  │             │
└──────────────┴──────────────────────────────────┴─────────────┘
 ◄─── 30% ────► ◄───────────── 50% ──────────────► ◄─── 20% ───►
```

### Left Section (30%) — split horizontally

| Region | Height | Purpose |
|--------|--------|---------|
| **Top — 3D Graph View** | 20% | Interactive 3D visualization of the exploration tree. Supports rotate, zoom, pan. Each anchor node is a selectable object. Connected nodes form a dream-catcher-like structure. |
| **Bottom** | 80% | Empty by default. Reserved space (future use or remains blank). |

### Middle Section (50%)

The **anchored answer**. Always displays the currently selected anchor's AI response. Stays fixed and readable while the user explores sub-questions.

### Right Section (20%) — 2D Thread List View

A **collapsible list** of all sub-questions asked about the current anchor's answer. Each item shows the sub-question and its response, expandable/collapsible inline.

---

## Input

There is **no visible input UI by default**. The question input overlay appears only when the user presses a **keyboard shortcut**. Once the question is submitted (or dismissed), the input disappears again.

---

## Interaction Flow

1. **User triggers the input** (keyboard shortcut) → types a question → submits → AI responds → answer fills the Middle section.
2. The question becomes the **root node** in the 3D Graph View.
3. User asks sub-questions about the answer → each appears as a **list item** in the Right section (2D Thread List).
4. Each sub-question's AI context = **only the anchor answer + that sub-question** (isolated).
5. User can **promote** any sub-question's answer into a **sub-anchor**:
   - A new node appears in the 3D Graph View, connected to its parent anchor.
   - Selecting that node loads its answer into the Middle section and its sub-questions into the Right section.
6. This repeats recursively — the 3D view grows into a **dream-catcher-like exploration graph**.

## 3D Graph View Behaviour

- Root node at center/top, child anchors branch outward.
- Edges connect parent anchor → child anchor.
- Click a node → Middle section shows that anchor's answer, Right section shows its sub-questions.
- Visual feedback: current node highlighted, explored nodes dimmed, unexplored paths hinted.
