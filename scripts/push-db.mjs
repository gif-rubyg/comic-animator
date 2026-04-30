import { spawn } from 'child_process';

const proc = spawn('pnpm', ['drizzle-kit', 'push'], {
  cwd: '/home/ubuntu/comic-animator',
  stdio: ['pipe', 'inherit', 'inherit']
});

// Every 300ms, send Enter to auto-confirm prompts (selects default = No truncate)
const interval = setInterval(() => {
  try { proc.stdin.write('\n'); } catch(e) {}
}, 300);

proc.on('close', (code) => {
  clearInterval(interval);
  console.log('drizzle-kit push exited with code:', code);
  process.exit(code ?? 0);
});
