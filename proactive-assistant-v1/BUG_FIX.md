# Bug Fix for Pieces Copilot Service

## Fixed Issues

### Issue 1: Missing `new` for Configuration
**Error**: `TypeError: Class constructor Configuration cannot be invoked without 'new'`

**Original Code**:
```javascript
this.configuration = pieces.Configuration({
  basePath: `http://localhost:${port}`
});
```

**Fixed Code**:
```javascript
this.configuration = new pieces.Configuration({
  basePath: `http://localhost:${port}`
});
```

**Rationale**: Configuration is a class constructor and requires `new` keyword.

### Issue 2: Incorrect API Constructor Arguments
**Error**: API classes may not accept direct configuration argument

**Original Code**:
```javascript
this.qgptApi = new pieces.QGPTApi(this.configuration);
this.assetsApi = new pieces.AssetsApi(this.configuration);
this.connectorApi = new pieces.ConnectorApi(this.configuration);
```

**Fixed Code**:
```javascript
this.qgptApi = new pieces.QGPTApi({ configuration: this.configuration });
this.assetsApi = new pieces.AssetsApi({ configuration: this.configuration });
this.connectorApi = new pieces.ConnectorApi({ configuration: this.configuration });
```

**Rationale**: Pieces SDK API constructors expect a configuration object parameter, not direct configuration.

## Applied Fixes

All issues have been fixed in `server/services/piecesCopilotService.js`

## Verification

After fixing, restart server:
```bash
cd server
npm start
```

Should see:
```
✓ Connected to Pieces OS
```

No more "Configuration cannot be invoked without 'new'" errors.
