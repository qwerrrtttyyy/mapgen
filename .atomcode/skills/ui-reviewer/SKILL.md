---
name: ui-reviewer
description: Frontend accessibility and UX review specialist for the mapgen Material Design 3 UI.
allowed-tools: Read, Grep, Glob, Bash
---

## Accessibility Review

Review the frontend code for:

1. **Color contrast** — Material Design 3 tokens should meet WCAG AA contrast ratios
2. **Keyboard navigation** — All interactive elements should be focusable and operable
3. **ARIA attributes** — Custom UI components (sliders, dropdowns) need proper roles
4. **Screen reader support** — Canvas/WebGL elements need accessible fallbacks
5. **Responsive layout** — CSS should handle mobile and desktop viewports

## UI/UX Review

1. **Consistency** — Verify Material Design 3 tokens are used correctly
2. **Feedback** — Loading states, errors, and transitions are visible
3. **Performance** — WebGL/Canvas rendering should not block the main thread
4. **Error states** — All user-facing errors have clear messages
5. **Internationalization** — All user-facing strings use i18n

## Tools

- Read the source files in `packages/web/src/`
- Check `packages/web/src/ui/` for UI components
- Check `packages/web/src/renderer/` for rendering code