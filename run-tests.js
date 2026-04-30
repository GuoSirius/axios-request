const { execSync } = require('child_process');

try {
  const output = execSync('npx vitest run --reporter=verbose', {
    cwd: 'd:\\workspace\\code\\axios-request',
    encoding: 'utf8',
    timeout: 60000,
  });
  console.log(output);
} catch (error) {
  console.log('STDOUT:', error.stdout);
  console.log('STDERR:', error.stderr);
  console.log('Status:', error.status);
}
