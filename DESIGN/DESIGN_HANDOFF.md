# NeuroFlow Studio — UI concept v2

## Product direction

Quiet infrastructure: a professional single-user workspace for AI agents, workflows, knowledge, and tools. No SaaS pricing, no growth marketing, no generic AI imagery.

## Screens

1. Overview — command center, task queue, grounded system status, agent roster, activity feed.
2. Agents — master-detail agent browser, model/memory/permission settings, allowed tools.
3. Workflows — node-based scenario editor with input, orchestrator, knowledge lookup, output gate.
4. Second Brain — library folders, searchable documents, document preview, related knowledge.

## Design foundations

- Canvas: `#F6F7F4`.
- Surface: `#FFFFFF`.
- Text primary: `#212A25`.
- Text secondary: `#68766D`.
- Stroke: `#E3E8E1`.
- Sidebar: `#17241D`.
- Accent: `#C9ED84`, restrained and reserved for state/selection.
- Action surface: `#243A2B`.
- Semantic success: `#356D4A`.
- Font: Inter with system fallbacks, body 12–13px, display 33px, sections 15px.
- Grid: sidebar 248px / main workspace / container horizontal padding 48px.
- Radius: 7–10px, borders 1px, subtle shadow.
- Hierarchy: data first, no stock art, no abstract 3D shapes, no decorative gradients.

## Prototype interactions

- Navigate between 4 screens.
- Press `Ctrl+K` or `⌘K` for command/navigation palette.
- Add a demo task from the Overview (in-memory only).
- Filter tasks by status.
- Choose an agent to see its role, memory, modes, and allowed tools.
- Search and filter notes in Second Brain; open note previews.

## Figma status

This package is a separate HTML/CSS/JS reference prototype; it is **not** a synced Figma design. Existing Figma document was read, but direct writes were blocked by the Starter MCP rate limit. Do not treat this package as an exported editable Figma file. The document can be rebuilt in Figma from this reference using frames/components/auto layout when editing access is available.

## View

Open `NeuroFlow_Studio_v2.html` in a browser. No installation, backend, CDN, or network request is needed.
