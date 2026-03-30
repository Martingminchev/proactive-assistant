# Proactive AI Assistant - Webview UI

React-based webview UI for the VS Code extension, built with Vite and TypeScript.

## Architecture

```
webview/
├── index.html              # HTML template
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── public/
│   └── animations.css      # Shared animation keyframes
└── src/
    ├── main.tsx            # React entry point
    ├── App.tsx             # Main application component
    ├── vite-env.d.ts       # Vite type declarations
    ├── components/         # React components
    │   ├── SuggestionCard.tsx
    │   ├── CurrentStatus.tsx
    │   ├── FocusToggle.tsx
    │   ├── Celebration.tsx
    │   ├── StatsPanel.tsx
    │   └── SettingsPanel.tsx
    ├── hooks/              # Custom React hooks
    │   ├── useExtensionApi.ts
    │   └── useTheme.ts
    ├── styles/             # CSS files
    │   ├── main.css
    │   └── theme.css
    └── types/              # TypeScript types
        └── index.ts
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## VS Code Integration

The webview communicates with the extension host via the VS Code API:

### Incoming Messages (Extension → Webview)

- `suggestions` - New suggestions available
- `status` - Current activity status update
- `stats` - Statistics data
- `settings` - User settings
- `celebration` - Achievement/milestone celebration
- `theme-changed` - VS Code theme changed

### Outgoing Messages (Webview → Extension)

- `ready` - Webview initialized
- `apply-suggestion` - User accepted suggestion
- `dismiss-suggestion` - User dismissed suggestion
- `snooze-suggestion` - User snoozed suggestion
- `toggle-focus` - Focus mode toggled
- `update-settings` - Settings changed
- `request-*` - Data requests

## Design System

### Colors
Uses VS Code CSS variables for native theming:
- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-button-background`
- etc.

### Spacing
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px

### Animations
- 300ms default transition
- Respects `prefers-reduced-motion`
