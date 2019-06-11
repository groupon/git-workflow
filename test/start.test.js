'use strict';

const fs = require('fs');
const { promisify } = require('util');

const assert = require('assertive');

const addHooks = require('./test-common');
const { action: startAction } = require('../lib/commands/start');

const readFile = promisify(fs.readFile);

describe('start', () => {
  const t = addHooks();

  it('creates a feature branch', async () => {
    await startAction(t, 'kittens');
    const { branches } = await t.git.branch(['-vv']);
    assert.expect('local branch created', !!branches.kittens);
    assert.match('on origin remote', /^\[origin\//, branches.kittens.label);
    assert.include(
      'remote branch pushed',
      'jdoe/feature/master/kittens',
      (await t.ghGit.branchLocal()).all
    );
  });

  it('--fork creates a feature branch on a fork', async () => {
    t.git = t.gitFork;
    await startAction(t, 'kittens', { fork: true });
    const { branches } = await t.git.branch(['-vv']);
    assert.expect('local branch created', !!branches.kittens);
    assert.match('on fork remote', /^\[fork\//, branches.kittens.label);
    assert.include(
      'remote branch on fork pushed',
      'feature/master/kittens',
      (await t.ghGit.branchLocal()).all
    );
  });

  it('--stash stashes files first', async () => {
    const readmePath = `${t.localDir}/README`;
    await t.changeSomething();
    const newREADME = await readFile(readmePath, 'utf8');
    await startAction(t, 'kittens', { stash: true });
    const { branches } = await t.git.branch(['-vv']);
    assert.expect('local branch created', !!branches.kittens);
    assert.match('on origin remote', /^\[origin\//, branches.kittens.label);
    assert.include(
      'remote branch pushed',
      'jdoe/feature/master/kittens',
      (await t.ghGit.branchLocal()).all
    );
    assert.equal(newREADME, await readFile(readmePath, 'utf8'));
  });

  it('--pr-base overrides recorded parent branch', async () => {
    await startAction(t, 'kittens', { prBase: 'other' });
    const { branches } = await t.git.branch(['-vv']);
    assert.expect('local branch created', !!branches.kittens);
    assert.match('on origin remote', /^\[origin\//, branches.kittens.label);
    assert.include(
      'remote branch pushed',
      'jdoe/feature/other/kittens',
      (await t.ghGit.branchLocal()).all
    );
  });
});
