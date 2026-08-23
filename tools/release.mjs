// Cut a release from one command:
//
//   npm run release            patch  (1.1.0 -> 1.1.1)
//   npm run release minor      1.1.0 -> 1.2.0
//   npm run release major      1.1.0 -> 2.0.0
//   npm run release -- --dry   build and verify, but leave it as a draft
//
// This only pulls the trigger. The actual work — version bump, tag, build on
// three platforms, publishing the artifacts and the update feed — happens in
// .github/workflows/release.yml, so a release from a laptop and a release from
// the GitHub UI are byte-for-byte the same process.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BUMPS = ['patch', 'minor', 'major'];

const args = process.argv.slice(2);
const dry = args.includes('--dry') || args.includes('--dry-run');
const bump = args.find((a) => BUMPS.includes(a)) || 'patch';

const die = (msg) => { console.error(`\n  ${msg}\n`); process.exit(1); };

const run = (cmd, cmdArgs, { capture = true } = {}) => {
  try {
    const out = execFileSync(cmd, cmdArgs, {
      encoding: 'utf8',
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: process.platform === 'win32',
    });
    return (out || '').trim();
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().trim();
    throw new Error(detail || `${cmd} failed`);
  }
};

// ---- preflight ------------------------------------------------------------
// Everything here is checked locally because the alternative is finding out
// three minutes into a CI run.

try {
  run('gh', ['--version']);
} catch {
  die('The GitHub CLI is not installed. Get it from https://cli.github.com, or run the\n  Release workflow from the Actions tab instead.');
}

try {
  run('gh', ['auth', 'status']);
} catch {
  die('You are not signed in to GitHub. Run:  gh auth login');
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  die(`Releases are cut from main; you are on "${branch}".`);
}

if (run('git', ['status', '--porcelain'])) {
  die('You have uncommitted changes. Commit or stash them first —\n  the workflow releases what is on origin/main, not what is on your disk.');
}

run('git', ['fetch', 'origin', 'main']);
const behind = run('git', ['rev-list', '--count', 'HEAD..origin/main']);
const ahead = run('git', ['rev-list', '--count', 'origin/main..HEAD']);
if (behind !== '0') die(`Your main is ${behind} commit(s) behind origin. Pull first.`);
if (ahead !== '0') die(`You have ${ahead} unpushed commit(s). Push them first, or they will not be in the release.`);

const current = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const next = (() => {
  const [maj, min, pat] = current.split('.').map(Number);
  if (bump === 'major') return `${maj + 1}.0.0`;
  if (bump === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
})();

// ---- go -------------------------------------------------------------------
console.log(`\n  ${current} -> ${next}  (${bump})${dry ? '  [dry run — stays a draft]' : ''}`);
console.log('  Triggering the Release workflow…');

try {
  run('gh', ['workflow', 'run', 'release.yml', '-f', `bump=${bump}`, '-f', `dry_run=${dry}`]);
} catch (err) {
  die(`Could not start the workflow:\n  ${err.message}`);
}

// The run takes a moment to appear in the API.
await new Promise((r) => setTimeout(r, 6000));

let id = '';
try {
  id = run('gh', ['run', 'list', '--workflow', 'release.yml', '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId']);
} catch { /* fall through to the friendly message below */ }

if (!id) {
  console.log('\n  Started. Watch it at: gh run watch --workflow release.yml\n');
  process.exit(0);
}

console.log(`  Run ${id} started. Watching…\n`);
try {
  run('gh', ['run', 'watch', id, '--exit-status', '--compact'], { capture: false });
} catch {
  die(`The release failed. See:  gh run view ${id} --log-failed`);
}

const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
console.log(dry
  ? `\n  Built and verified. The draft is at https://github.com/${repo}/releases\n`
  : `\n  Released: https://github.com/${repo}/releases/tag/v${next}\n  Installed copies will offer it within six hours.\n`);
