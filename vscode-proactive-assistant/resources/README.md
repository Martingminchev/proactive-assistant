# Visual Assets

This directory contains all visual assets for the Proactive AI Assistant VS Code extension.

## File Structure

```
resources/
├── icon.png              # Main extension icon (256x256)
├── icon-source.svg       # Source SVG for icon.png
├── logo.png              # README/marketplace logo (128x128)
├── logo-source.svg       # Source SVG for logo.png
├── icons/                # Status bar icons (16x16)
│   ├── robot-idle.svg    # Gray - Inactive state
│   ├── robot-watching.svg# Blue - Active monitoring
│   ├── robot-suggestion.svg # Amber - Suggestion available
│   ├── robot-urgent.svg  # Red - User stuck
│   ├── robot-focus.svg   # Purple - Focus mode active
│   └── robot-offline.svg # Gray - Disconnected
└── README.md             # This file
```

## Generating PNG Icons

### Option 1: Using Node.js (Recommended)

```bash
cd vscode-proactive-assistant
npm install sharp
node scripts/generate-icons.js
```

### Option 2: Using Python

```bash
cd vscode-proactive-assistant
pip install cairosvg
python scripts/generate-icons.py
```

### Option 3: Online Converters

1. Go to [SVG to PNG](https://svgtopng.com/) or similar service
2. Upload `icon-source.svg` → Download as `icon.png` (256x256)
3. Upload `logo-source.svg` → Download as `logo.png` (128x128)
4. Place files in this directory

## Icon Design System

See [docs/DESIGN.md](../docs/DESIGN.md) for complete design specifications including:

- Color palette
- Iconography guidelines
- Animation specifications
- Accessibility requirements
- Theme integration details

## Icon Usage

### Status Bar Icons

Icons are referenced in the extension code using VS Code's icon contribution point:

```json
{
  "contributes": {
    "icons": {
      "robot-idle": {
        "description": "Robot idle state",
        "default": {
          "iconPath": "./resources/icons/robot-idle.svg"
        }
      }
    }
  }
}
```

Then used in code:

```typescript
statusBarItem.text = '$(robot-watching)';
```

## Requirements

- **Format**: SVG for icons (scalable), PNG for marketplace
- **Sizes**: 16x16 (status bar), 128x128 (logo), 256x256 (extension icon)
- **Style**: Filled, minimal, recognizable at small sizes
- **Colors**: Use VS Code theme variables where possible
