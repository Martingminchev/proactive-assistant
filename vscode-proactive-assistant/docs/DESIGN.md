# Proactive AI Assistant - Design System

Visual design guidelines, specifications, and assets for the VS Code extension.

---

## Table of Contents

1. [Color Palette](#color-palette)
2. [Iconography](#iconography)
3. [Typography](#typography)
4. [Animation Specifications](#animation-specifications)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Theme Integration](#theme-integration)
7. [Asset Inventory](#asset-inventory)

---

## Color Palette

### Primary Brand Colors

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Brand Blue | `#58A6FF` | Active state, primary actions, watching mode |
| Brand Blue Dark | `#1F6FEB` | Hover states, emphasis |
| Brand Blue Light | `#79B8FF` | Highlights, glows |

### Status Colors

| Color Name | Hex Value | Usage | Icon State |
|------------|-----------|-------|------------|
| Success Green | `#3FB950` | Success states, positive feedback | - |
| Warning Amber | `#D29922` | Suggestions available, attention needed | robot-suggestion |
| Warning Orange | `#E3B341` | Secondary warnings | - |
| Error Red | `#F85149` | Errors, urgent help needed, stuck state | robot-urgent |
| Accent Purple | `#A371F7` | Focus mode active, special states | robot-focus |
| Pink | `#F778BA` | Highlights, secondary accent | - |

### Neutral Colors (Dark Theme)

| Shade | Hex Value | Usage |
|-------|-----------|-------|
| Gray 100 | `#F0F6FC` | Primary text on dark |
| Gray 200 | `#C9D1D9` | Secondary text |
| Gray 300 | `#B1BAC4` | Tertiary text |
| Gray 400 | `#8B949E` | Muted text, descriptions |
| Gray 500 | `#6E7681` | Idle state, disabled | robot-idle |
| Gray 600 | `#484F58` | Borders, dividers |
| Gray 700 | `#30363D` | Subtle backgrounds |
| Gray 800 | `#21262D` | Input backgrounds |
| Gray 900 | `#161B22` | Deep backgrounds |

### State-Specific Color Mapping

```
┌─────────────────────┬──────────────────┬─────────────────────────────────┐
│ State               │ Primary Color    │ Visual Treatment                │
├─────────────────────┼──────────────────┼─────────────────────────────────┤
│ Idle                │ Gray 500 (#6E7681│ Flat, no animation              │
│                     │ )                │                                 │
├─────────────────────┼──────────────────┼─────────────────────────────────┤
│ Watching            │ Brand Blue       │ Subtle pulse animation          │
│                     │ (#58A6FF)        │                                 │
├─────────────────────┼──────────────────┼─────────────────────────────────┤
│ Suggestion          │ Warning Amber    │ Badge/dot indicator, gentle     │
│                     │ (#D29922)        │ pulse                           │
├─────────────────────┼──────────────────┼─────────────────────────────────┤
│ Urgent              │ Error Red        │ Rapid pulse, high visibility    │
│                     │ (#F85149)        │                                 │
├─────────────────────┼──────────────────┼─────────────────────────────────┤
│ Focus Mode          │ Accent Purple    │ Solid, no pulse                 │
│                     │ (#A371F7)        │                                 │
├─────────────────────┼──────────────────┼─────────────────────────────────┤
│ Offline             │ Gray 600         │ Muted, X indicator overlay      │
│                     │ (#484F58)        │                                 │
└─────────────────────┴──────────────────┴─────────────────────────────────┘
```

---

## Iconography

### Robot Icon Set

All robot icons follow a consistent design language optimized for 16x16 display.

#### Base Robot Structure

```
┌─────────────────────┐
│      ┌───────┐      │  ← Head (4x3, rounded)
│      │  ◉ ◉  │      │  ← Eyes (circular)
│      └───────┘      │
│  ┌───────────────┐  │  ← Body (8x7, rounded)
│  │               │  │
│  │      ═══      │  │  ← Mouth (line)
│  └───────────────┘  │
└─────────────────────┘
```

#### Icon Specifications

| Property | Value |
|----------|-------|
| ViewBox | `0 0 16 16` |
| Canvas Size | 16x16 pixels |
| Safe Zone | 1px padding on all sides |
| Stroke Width | N/A (filled style) |
| Corner Radius | 1.5px for body, 1px for head |
| Eye Size | 1px radius |

#### Icon States

##### 1. Robot Idle (`robot-idle.svg`)
- **Color:** Gray 500 (#6E7681)
- **Eyes:** Gray 200 (#C9D1D9)
- **Animation:** None
- **Meaning:** Extension loaded but not actively watching

##### 2. Robot Watching (`robot-watching.svg`)
- **Color:** Brand Blue (#58A6FF)
- **Eyes:** White (#FFFFFF)
- **Animation:** Subtle pulse (2s ease-in-out infinite)
- **Meaning:** Actively monitoring user activity

##### 3. Robot Suggestion (`robot-suggestion.svg`)
- **Color:** Warning Amber (#D29922)
- **Eyes:** White (#FFFFFF)
- **Indicator:** Red dot in top-right (2px radius)
- **Animation:** Badge pulse on indicator
- **Meaning:** Suggestion available for user

##### 4. Robot Urgent (`robot-urgent.svg`)
- **Color:** Error Red (#F85149)
- **Eyes:** White (#FFFFFF)
- **Indicator:** Exclamation triangle above head
- **Animation:** Rapid pulse (1s)
- **Meaning:** User appears stuck, urgent help needed

##### 5. Robot Focus (`robot-focus.svg`)
- **Color:** Accent Purple (#A371F7)
- **Eyes:** White (#FFFFFF)
- **Indicator:** Target/circle icon in top-right
- **Animation:** None (static, focused state)
- **Meaning:** Focus mode is active

##### 6. Robot Offline (`robot-offline.svg`)
- **Color:** Gray 600 (#484F58)
- **Eyes:** Gray 500 (#6E7681) - muted
- **Indicator:** X mark in top-right
- **Animation:** None
- **Meaning:** Pieces OS disconnected

### Design Principles

1. **Simplicity:** Icons must be recognizable at 16x16
2. **Consistency:** Same stroke weights, corner radii, and proportions
3. **Clarity:** Clear visual distinction between states
4. **Scalability:** SVG format for crisp rendering at any size
5. **Theme Awareness:** Colors adapt to VS Code theme variables

---

## Typography

### Font Stack

```css
font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
```

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 1.5rem (24px) | 600 | Panel title |
| H2 | 1.25rem (20px) | 600 | Section headers |
| H3 | 1.125rem (18px) | 600 | Card titles |
| Body | 1rem (16px) | 400 | Main content |
| Body Small | 0.875rem (14px) | 400 | Secondary text |
| Caption | 0.75rem (12px) | 400 | Metadata, timestamps |
| Tiny | 0.625rem (10px) | 500 | Badges, labels |

### Line Heights

- **Headings:** 1.2
- **Body:** 1.5
- **UI Elements:** 1.4

---

## Animation Specifications

### Timing Functions

| Name | CSS Value | Usage |
|------|-----------|-------|
| Default | `ease` | General transitions |
| Entrance | `ease-out` | Elements appearing |
| Exit | `ease-in` | Elements disappearing |
| Bounce | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful interactions |
| Smooth | `cubic-bezier(0.4, 0, 0.2, 1)` | Material-style motion |

### Duration Guidelines

| Type | Duration | Usage |
|------|----------|-------|
| Micro | 100-150ms | Hover states, button feedback |
| Standard | 200-300ms | Panel transitions, modals |
| Complex | 300-500ms | Multi-element animations |
| Ambient | 2-3s | Background pulses, indicators |

### Animation Patterns

#### 1. Pulse Animation (Watching State)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
```

#### 2. Fade In/Out
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
animation: fade-in 0.3s ease-out forwards;
```

#### 3. Slide In (Notifications)
```css
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
animation: slide-in-right 0.3s ease-out forwards;
```

#### 4. Confetti (Success Celebration)
```css
@keyframes confetti-fall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(200px) rotate(720deg); opacity: 0; }
}
animation: confetti-fall 2s ease-out forwards;
```

#### 5. Typing Indicator
```css
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
animation: typing 1.4s ease-in-out infinite;
```

### Performance Guidelines

- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Use `will-change` sparingly on animated elements
- Respect `prefers-reduced-motion` media query

---

## Accessibility Requirements

### Color Contrast

All color combinations must meet WCAG 2.1 AA standards:

| Text Type | Minimum Contrast |
|-----------|------------------|
| Normal text (< 18pt) | 4.5:1 |
| Large text (≥ 18pt bold / 24pt) | 3:1 |
| UI Components | 3:1 |

### Focus Indicators

- All interactive elements must have visible focus states
- Focus ring: 2px solid with 3px outline offset
- Use theme-aware focus colors (`--vscode-focusBorder`)

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support

- Icons must have aria-labels or be hidden with `aria-hidden="true"`
- Status changes must be announced with `role="status"` or `aria-live`
- Color alone must not convey meaning (use icons + text)

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Tab order must be logical
- Escape key should dismiss modals/panels
- Arrow keys for list navigation

---

## Theme Integration

### VS Code Theme Variables

The extension uses VS Code's CSS variables for seamless theming:

```css
/* Core colors */
--vscode-foreground           /* Text color */
--vscode-editor-background    /* Background */
--vscode-button-background    /* Primary actions */

/* Status */
--vscode-charts-red           /* Error/urgent */
--vscode-charts-blue          /* Info/active */
--vscode-charts-yellow        /* Warning */
--vscode-charts-green         /* Success */
--vscode-charts-purple        /* Accent */
```

### Theme Support Matrix

| Theme Type | Support Level | Notes |
|------------|---------------|-------|
| Dark | Full | Default, optimized |
| Light | Full | Color adjustments for contrast |
| High Contrast | Full | Enhanced borders, no shadows |
| Custom | Partial | Relies on theme variables |

### Testing Themes

Test with these built-in themes:
- Dark+ (default)
- Light+
- High Contrast
- Abyss
- Monokai
- Quiet Light

---

## Asset Inventory

### Icons

| File | Path | Size | Format |
|------|------|------|--------|
| Main Icon | `resources/icon.png` | 256x256 | PNG |
| Logo | `resources/logo.png` | 128x128 | PNG |
| Robot Idle | `resources/icons/robot-idle.svg` | 16x16 | SVG |
| Robot Watching | `resources/icons/robot-watching.svg` | 16x16 | SVG |
| Robot Suggestion | `resources/icons/robot-suggestion.svg` | 16x16 | SVG |
| Robot Urgent | `resources/icons/robot-urgent.svg` | 16x16 | SVG |
| Robot Focus | `resources/icons/robot-focus.svg` | 16x16 | SVG |
| Robot Offline | `resources/icons/robot-offline.svg` | 16x16 | SVG |

### Stylesheets

| File | Path | Purpose |
|------|------|---------|
| Theme CSS | `webview/src/styles/theme.css` | VS Code theme integration |
| Animations | `webview/public/animations.css` | All animation keyframes |

### Source Files

| File | Path | Purpose |
|------|------|---------|
| Icon Source | `resources/icon-source.svg` | 256x256 main icon (source) |
| Logo Source | `resources/logo-source.svg` | 128x128 logo (source) |

---

## Usage Examples

### Status Bar Icon Implementation

```typescript
// Status bar item with dynamic icon
const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100
);

// Set icon based on state
function updateIcon(state: RobotState) {
  const iconMap = {
    idle: '$(robot-idle)',
    watching: '$(robot-watching)',
    suggestion: '$(robot-suggestion)',
    urgent: '$(robot-urgent)',
    focus: '$(robot-focus)',
    offline: '$(robot-offline)'
  };
  statusBarItem.text = iconMap[state];
}
```

### Webview Theme Usage

```tsx
// React component using theme variables
import './styles/theme.css';

const Card = ({ children }) => (
  <div style={{
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-md)'
  }}>
    {children}
  </div>
);
```

### Animation Usage

```tsx
// Using animation classes
import '../public/animations.css';

const LoadingSpinner = () => (
  <div className="spinner-ring" role="status" aria-label="Loading">
    <span className="sr-only">Loading...</span>
  </div>
);

const PulsingBadge = () => (
  <span className="badge-pulse">New</span>
);
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-29 | Initial design system |

---

## Resources

- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [SVG Optimization Guide](https://github.com/svg/svgo)
