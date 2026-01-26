# Port Configuration Guide

## Current Port Status

Based on the port check, the following ports are currently in use:
- **Port 3000**: ❌ IN USE (Process ID: 16380)
- **Port 5173**: ❌ IN USE (Process ID: 22688)
- **Port 5000**: ❌ IN USE (Process ID: 26608)

## Solution

The Vite configuration has been updated to use **port 3001** instead of 3000 to avoid conflicts.

### Current Configuration

The `vite.config.js` file is configured with:
- **Port**: 3001
- **strictPort**: false (automatically tries next available port if 3001 is busy)
- **host**: true (allows network access)

## Check Port Availability

### Option 1: Using PowerShell Script (Recommended for Windows)

```powershell
npm run check-ports:ps1
```

Or directly:
```powershell
powershell -ExecutionPolicy Bypass -File check-ports.ps1
```

### Option 2: Using Node.js Script

```bash
npm run check-ports
```

### Option 3: Manual Check

Check a specific port:
```powershell
netstat -ano | findstr :3001
```

Check all common development ports:
```powershell
netstat -ano | findstr "3000 3001 3002 5173 5174 8080"
```

## Change Port Manually

If you need to use a different port, edit `vite.config.js`:

```javascript
export default defineConfig({
  server: {
    port: 3002, // Change to your preferred port
    strictPort: false, // Auto-find next available port if busy
    open: true,
    host: true
  }
})
```

## Port Recommendations

- **3001-3009**: Good for development servers
- **5173-5179**: Vite default range
- **8080-8090**: Alternative development ports
- **4000-4010**: Node.js common ports
- **5000-5010**: Flask/other frameworks

## Troubleshooting

### Port Still in Use?

1. **Find the process using the port:**
   ```powershell
   netstat -ano | findstr :3000
   ```
   Note the PID (Process ID) from the last column

2. **Kill the process (if needed):**
   ```powershell
   taskkill /PID <PID> /F
   ```
   Replace `<PID>` with the actual Process ID

3. **Or use a different port** by updating `vite.config.js`

### Vite Auto-Port Selection

With `strictPort: false`, Vite will automatically try the next available port if the configured port is busy. For example:
- If 3001 is busy, it will try 3002
- If 3002 is busy, it will try 3003
- And so on...

The actual port will be shown in the terminal when you run `npm run dev`.

## Network Access

With `host: true` in the config, the dev server is accessible from:
- **Local**: `http://localhost:3001`
- **Network**: `http://<your-ip>:3001`

To find your IP address:
```powershell
ipconfig | findstr IPv4
```
