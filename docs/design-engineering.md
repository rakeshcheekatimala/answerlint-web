# Design Engineering Standard

This app should feel precise, fast, and trustworthy. Use these rules when changing UI, writing components, or adding motion.

The standard is inspired by Emil Kowalski's writing on purposeful animation, taste, judgement, and component craft. Treat it as a practical checklist, not a decorative style.

## Product Feel

- Optimize for trust before delight. CiteOps is an audit and visibility product, so the UI should feel clear, deterministic, and calm.
- Make user intent obvious. Primary actions should be visually direct, labels should say the outcome, and dashboards should surface the next decision.
- Details compound. Borders, spacing, pressed states, loading states, focus states, copy feedback, and empty states should all feel like one system.
- Prefer product evidence over decoration. A visual element should explain a score, workflow, report, or action. Remove it if it only fills space.

## Motion Rules

- Animate only with a purpose: clarify state change, preserve spatial continuity, acknowledge an action, or explain a product workflow.
- Keep routine UI motion under 300ms. Most app interactions should feel immediate; 120ms to 220ms is usually enough.
- Do not animate high-frequency workflows. Inputs, keyboard navigation, repeated dashboard scanning, table interactions, and business scan review loops should stay fast.
- Never let motion block comprehension. If the user is trying to read scores, compare issues, or choose pages, motion should get out of the way.
- Use `ease-out` or a stronger custom ease-out for entering UI. Avoid slow `ease-in` entrances that make the app feel delayed.
- Make overlays and popovers origin-aware. Menus, popovers, drawers, and tooltips should appear from the trigger or from the edge they belong to.
- Avoid `scale(0)` entrances. Start around `scale(0.96)` to `scale(0.98)` if scale is needed.
- Respect `prefers-reduced-motion`. Any non-essential animation must degrade gracefully.

## Interaction Feedback

- Every direct action needs feedback. Copy, submit, save, scan, unlock, and filter actions should visibly confirm what happened.
- Copy-to-clipboard controls should use an icon button, switch to a success checkmark briefly, and not require users to select text manually.
- Buttons may use a subtle active press effect, roughly `scale(0.97)`, when it makes the interface feel responsive.
- Loading states should preserve layout. Define stable heights for score cards, terminals, dashboards, and report panels before content appears.
- Use skeletons only when they reduce uncertainty. Do not use skeletons when they hide useful progress or block a workflow the user needs to monitor.
- Prefer progress text when the user benefits from knowing what is happening, such as discovery, scanning, or report generation.

## Component Craft

- Build reusable components for repeated micro-interactions, such as command copy blocks, score cards, status chips, issue rows, and report cards.
- A component should own its interaction contract: default, hover, active, focus, loading, disabled, success, and error states.
- Stable dimensions matter. Repeated cards, score gauges, terminal blocks, and dashboard metrics should not resize when content changes.
- Copy and visual state must agree. If a status says `Fix queued`, the surrounding treatment should look actionable, not decorative.
- Use mono type for commands, scores, IDs, issue numbers, JSON, and machine-readable output.
- Keep component APIs boring and explicit. Avoid clever variants when a clear prop name better communicates intent.

## Dashboard And Report UX

- Lead with the executive decision, then reveal technical evidence.
- Keep business impact and developer execution visually separate. A business card should explain risk and opportunity; a developer card should show exact fixes.
- Scores need visual context. Pair numbers with rings, bars, deltas, thresholds, or status language.
- Fixes should look executable. Style recommendations like issues, PR comments, or CI tasks rather than generic bullets.
- CI/CD visuals should show flow and consequence: commit, action, audit, pass/block.

## Animation Review Checklist

Before shipping motion, answer:

- What purpose does this animation serve?
- How often will the user see it?
- Does it make the interface feel faster or slower?
- Can the user interrupt it without jank?
- Does it preserve spatial continuity?
- Does it still work with reduced motion?
- Would removing it make the workflow better?

If the answer is unclear, remove the animation.

## Taste Review Checklist

Before shipping a UI change, review:

- Is the first visible thing the user's next decision or a decorative artifact?
- Is any text trying to do layout work that spacing or grouping should do?
- Are important numbers scannable within two seconds?
- Does the component explain what happened after an action?
- Is there any repeated interaction that now feels slower?
- Does the UI still feel calm after three consecutive uses?
- Can you name why the new version feels better?

If you cannot explain why it feels better, keep iterating.
