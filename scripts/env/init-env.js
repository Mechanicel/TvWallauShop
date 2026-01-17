const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const targets = [
  {
    example: path.join(repoRoot, 'infra', '.env.example'),
    target: path.join(repoRoot, 'infra', '.env'),
  },
  {
    example: path.join(repoRoot, 'infra', 'backend.env.example'),
    target: path.join(repoRoot, 'infra', 'backend.env'),
  },
];

const toEmptyEnv = (contents) => {
  return contents
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }
      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
        return line;
      }
      const key = line.slice(0, equalsIndex).trim();
      return `${key}=`;
    })
    .join('\n');
};

for (const { example, target } of targets) {
  if (fs.existsSync(target)) {
    continue;
  }
  if (!fs.existsSync(example)) {
    console.warn(`[env-init] Missing example file: ${example}`);
    continue;
  }
  const exampleContents = fs.readFileSync(example, 'utf8');
  const emptyContents = toEmptyEnv(exampleContents);
  fs.writeFileSync(target, `${emptyContents}\n`, 'utf8');
  console.log(`[env-init] Created ${path.relative(repoRoot, target)}`);
}
