'use strict';

const assert = require('assert');
const fs = require('fs');
const { promisify } = require('util');
const addHooks = require('./test-common');
const { action: startAction } = require('../lib/commands/start');

const readFile = promisify(fs.readFile);
describe('start', () => {
  const t = addHooks();
  it('creates a feature branch', async () => {
    await startAction({
      deps: t,
      args: ['kittens'],
      opts: {},
    });
    const { branches } = await t.git.branch(['-vv']);
    assert.strictEqual(!!branches.kittens, true, 'local branch created');
    assert.match(branches.kittens.label, /^\[origin\//, 'on origin remote');
    assert.match(
      (await t.ghGit.branchLocal()).all,
      /jdoe\/feature\/master\/kittens/,
      'remote branch pushed'
    );
  });
  it('--fork creates a feature branch on a fork', async () => {
    t.git = t.gitFork;
    await startAction({
      deps: t,
      args: ['kittens'],
      opts: {
        fork: true,
      },
    });
    const { branches } = await t.git.branch(['-vv']);
    assert.strictEqual(!!branches.kittens, true, 'local branch created');
    assert.match(branches.kittens.label, /^\[fork\//, 'on fork remote');
    assert.match(
      (await t.ghGit.branchLocal()).all,
      /feature\/master\/kittens/,
      'remote branch on fork pushed'
    );
  });
  it('--stash stashes files first', async () => {
    const readmePath = `${t.localDir}/README`;
    await t.changeSomething();
    const newREADME = await readFile(readmePath, 'utf8');
    await startAction({
      deps: t,
      args: ['kittens'],
      opts: {
        stash: true,
      },
    });
    const { branches } = await t.git.branch(['-vv']);
    assert.strictEqual(!!branches.kittens, true, 'local branch created');
    assert.match(branches.kittens.label, /^\[origin\//, 'on origin remote');
    assert.match(
      (await t.ghGit.branchLocal()).all,
      /jdoe\/feature\/master\/kittens/,
      'remote branch pushed'
    );
    assert.strictEqual(await readFile(readmePath, 'utf8'), newREADME);
  });
  it('--pr-base overrides recorded parent branch', async () => {
    await startAction({
      deps: t,
      args: ['kittens'],
      opts: {
        prBase: 'other',
      },
    });
    const { branches } = await t.git.branch(['-vv']);
    assert.strictEqual(!!branches.kittens, true, 'local branch created');
    assert.match(branches.kittens.label, /^\[origin\//, 'on origin remote');
    assert.match(
      (await t.ghGit.branchLocal()).all,
      /jdoe\/feature\/other\/kittens/,
      'remote branch pushed'
    );
  });
});
