import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const env = { ...process.env };

function run(command, args, cwd) {
  const proc = spawn(command, args, {
    cwd: path.resolve(root, cwd),
    env,
    stdio: 'inherit',
    shell: true
  });

  proc.on('error', (err) => {
    console.error(`Failed to start ${cwd}:`, err);
  });

  return proc;
}

console.log('Starting AuthFusion Development Stack...');

const api = run('pnpm', ['--filter', '@workspace/api-server', 'dev'], '.');
const mfa = run('pnpm', ['--filter', '@workspace/secure-mfa', 'dev'], '.');

process.on('SIGINT', () => {
  api.kill();
  mfa.kill();
  process.exit();
});
