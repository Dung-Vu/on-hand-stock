/**
 * Port Checker Script
 * Checks which ports are in use and suggests available ports
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Common development ports to check
const COMMON_PORTS = [3000, 3001, 3002, 5173, 5174, 8080, 4000, 5000, 5001];

async function checkPort(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    return stdout.trim().length > 0;
  } catch (error) {
    // Port is not in use
    return false;
  }
}

async function checkAllPorts() {
  console.log('🔍 Checking port availability...\n');
  
  const results = [];
  
  for (const port of COMMON_PORTS) {
    const inUse = await checkPort(port);
    results.push({ port, inUse });
    
    const status = inUse ? '❌ IN USE' : '✅ AVAILABLE';
    console.log(`Port ${port.toString().padEnd(5)}: ${status}`);
  }
  
  console.log('\n📊 Summary:');
  const availablePorts = results.filter(r => !r.inUse).map(r => r.port);
  const usedPorts = results.filter(r => r.inUse).map(r => r.port);
  
  if (availablePorts.length > 0) {
    console.log(`\n✅ Available ports: ${availablePorts.join(', ')}`);
    console.log(`💡 Recommended: Use port ${availablePorts[0]}`);
  }
  
  if (usedPorts.length > 0) {
    console.log(`\n❌ Ports in use: ${usedPorts.join(', ')}`);
  }
  
  return availablePorts;
}

// Run the check
checkAllPorts().catch(console.error);
