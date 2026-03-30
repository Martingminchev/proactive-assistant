# NEXUS - AI Desktop Assistant

A futuristic, intelligent desktop companion powered by Kimi K2.5 with real-time system awareness and Pieces OS integration.

![Nexus Screenshot](./docs/screenshot.png)

## Features

### AI-Powered Conversations
- **Kimi K2.5 Integration**: Full streaming support for Moonshot AI's most capable model
- **Real-time Responses**: Watch as the AI thinks and responds in real-time
- **Smart Context**: Automatically includes system context for more relevant assistance
- **Code Highlighting**: Beautiful syntax highlighting for code blocks

### System Awareness
- **Active Window Tracking**: Knows what application you're working in
- **Resource Monitoring**: CPU, memory, and battery status in context
- **File Change Detection**: Monitors your projects for relevant changes
- **Clipboard History**: Access recently copied content (optional)

### Pieces OS Integration
- **Snippet Access**: Search and use your saved code snippets
- **Context Enrichment**: Pieces assets enhance AI understanding
- **Seamless Workflow**: Works alongside your existing Pieces setup

### Futuristic UI
- **Glassmorphism Design**: Modern, translucent interface elements
- **Neon Accents**: Cyberpunk-inspired cyan and violet color scheme
- **Smooth Animations**: Framer Motion powered transitions
- **Dark Theme**: Easy on the eyes for long coding sessions

### Productivity Features
- **Global Hotkey**: Invoke from anywhere with `Ctrl/Cmd + Shift + Space`
- **System Tray**: Lives in background, ready when you need it
- **Persistent Conversations**: Auto-saved chat history
- **Quick Actions**: Jump into common tasks instantly

## Installation

### Prerequisites
- Node.js 18+
- Kimi API Key from [platform.moonshot.cn](https://platform.moonshot.cn/)
- (Optional) Pieces OS installed for enhanced context

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/nexus-assistant.git
cd nexus-assistant

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for current platform
npm run package

# Build for specific platforms
npm run package:win
npm run package:mac
npm run package:linux
```

## Configuration

On first launch, NEXUS will prompt you to configure:

1. **Kimi API Key**: Required for AI functionality
2. **Default Model**: Choose between K2.5 variants
3. **Context Gathering**: Enable system awareness features
4. **Pieces OS**: Optional integration for developers

Settings can be accessed anytime via the gear icon or tray menu.

## Architecture

```
nexus-assistant/
├── src/
│   ├── main/              # Electron main process
│   │   ├── services/      # Core services
│   │   │   ├── kimi-client.ts      # Kimi API client
│   │   │   ├── pieces-client.ts    # Pieces OS integration
│   │   │   ├── context-monitor.ts  # System context gathering
│   │   │   └── conversation-store.ts
│   │   ├── main.ts        # Main entry point
│   │   └── preload.ts     # IPC bridge
│   ├── renderer/          # React frontend
│   │   ├── components/    # UI components
│   │   ├── stores/        # Zustand state management
│   │   ├── utils/         # Helper functions
│   │   └── styles/        # Global styles
│   └── shared/            # Shared types
├── assets/                # Icons and images
└── dist/                  # Build output
```

**Note:** `IntentEngine`, `MemoryStore`, and `PatternRecognition` are implemented and exported but not instantiated or wired in `main.ts`. Chat and proactive flows do not use intent detection today; these are available for future intent-aware features.

## Tech Stack

- **Framework**: Electron 28 + React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Markdown**: React Markdown + Prism

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Shift + Space` | Toggle window |
| `Esc` | Close/hide window |
| `Enter` | Send message |
| `Shift + Enter` | New line in input |

## API Reference

### Kimi API

NEXUS uses the Moonshot AI API (OpenAI-compatible):

- **Base URL**: `https://api.moonshot.cn/v1`
- **Documentation**: [platform.moonshot.cn/docs](https://platform.moonshot.cn/docs)

### Available Models

| Model | Context | Best For |
|-------|---------|----------|
| `kimi-k2.5` | 256K | General purpose, reasoning |
| `kimi-k2-0905-preview` | 256K | Coding, complex tasks |
| `kimi-k2-turbo-preview` | 256K | Fast responses |

## Troubleshooting

### Kimi API Not Working
1. Verify API key in Settings → API
2. Check internet connection
3. Test API key with the Test button

### Pieces OS Not Connecting
1. Ensure Pieces OS is running (check system tray)
2. Verify port 39300 is accessible
3. Try restarting Pieces OS

### High CPU Usage
1. Disable context gathering in Settings → Context
2. Reduce tracked directories
3. Disable clipboard tracking

## Development

### Running Tests
```bash
npm run lint
npm run typecheck
```

### Project Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run package` | Package for distribution |
| `npm run dev:watch` | Watch mode for development |

## Privacy & Security

- **Local Storage**: Conversations stored locally on your machine
- **API Key**: Never sent anywhere except Kimi's official API
- **Context Data**: System information stays on your device
- **Network**: Only connects to api.moonshot.cn and localhost (Pieces)

## License

MIT License - See [LICENSE](./LICENSE) for details

## Acknowledgments

- [Moonshot AI](https://moonshot.cn/) for the Kimi API
- [Pieces](https://pieces.app/) for developer context integration
- [Electron](https://electronjs.org/) for the desktop framework

---

Built with passion and a touch of neon ✨
