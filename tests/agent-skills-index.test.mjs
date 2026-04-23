import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const INDEX_PATH = join(ROOT, 'public/.well-known/agent-skills/index.json');
const SKILLS_DIR = join(ROOT, 'public/.well-known/agent-skills');

// Guards for the Agent Skills discovery manifest (#3310 / epic #3306).
// Agents trust the index.json sha256 fields; if they drift from the
// served SKILL.md bytes, every downstream verification check fails.
describe('agent readiness: agent-skills index', () => {
  it('index.json is up to date relative to SKILL.md sources', () => {
    // `--check` exits non-zero if rebuilding the index would change it.
    execFileSync(
      process.execPath,
      ['scripts/build-agent-skills-index.mjs', '--check'],
      { cwd: ROOT, stdio: 'pipe' },
    );
  });

  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));

  it('declares the RFC v0.2.0 schema', () => {
    assert.equal(index.$schema, 'https://agentskills.io/schemas/v0.2.0/index.json');
  });

  it('advertises at least two skills (epic #3306 acceptance floor)', () => {
    assert.ok(Array.isArray(index.skills));
    assert.ok(index.skills.length >= 2, `expected >=2 skills, got ${index.skills.length}`);
  });

  it('every entry points at a real SKILL.md whose bytes match the declared sha256', () => {
    for (const skill of index.skills) {
      assert.ok(skill.name, 'skill entry missing name');
      assert.equal(skill.type, 'task');
      assert.ok(skill.description && skill.description.length > 0, `${skill.name} missing description`);
      assert.match(
        skill.url,
        /^https:\/\/worldmonitor\.app\/\.well-known\/agent-skills\/[^/]+\/SKILL\.md$/,
        `${skill.name} url must be the canonical absolute URL`,
      );
      const local = join(SKILLS_DIR, skill.name, 'SKILL.md');
      const bytes = readFileSync(local);
      const hex = createHash('sha256').update(bytes).digest('hex');
      assert.equal(
        skill.sha256,
        hex,
        `${skill.name} sha256 does not match ${local}`,
      );
    }
  });

  it('every SKILL.md directory is represented in the index (no orphans)', () => {
    const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const names = index.skills.map((s) => s.name).sort();
    assert.deepEqual(names, dirs, 'every skill directory must have an index entry');
  });
});
