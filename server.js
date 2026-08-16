const { spawn } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'Backend');
const backendEntry = path.join(backendDir, 'server.js');

const child = spawn(process.execPath, [backendEntry], {
  cwd: backendDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to start backend server:', error);
  process.exit(1);
});
