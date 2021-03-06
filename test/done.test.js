'use strict';

const fs = require('fs');

const assert = require('assertive');

const addHooks = require('./test-common');
const { action: startAction } = require('../lib/commands/start');
const { action: doneAction } = require('../lib/commands/done');

describe('done', () => {
  const t = addHooks();
  it('cleans up a merged feature branch', async () => {
    await startAction({ deps: t, args: ['kittens'], opts: {} });
    await doneAction({ deps: t });
    assert.notInclude('kittens', (await t.git.branchLocal()).all);
  });

  it('cleans up a squash merged feature branch', async () => {
    // 1. creates a feature branch and switches to it
    await startAction({ deps: t, args: ['kittens'], opts: {} });

    // 2. simulate a squash merge with a specific diff
    await t.git.checkout('master');
    fs.writeFileSync('README', 'foobar\n');
    await t.git.commit('squash merge', ['README']);

    // 3. simulate the same change in the feature branch
    await t.git.checkout('kittens');
    fs.writeFileSync('README', 'foobar\n');
    await t.git.commit('my change', ['README']);

    await doneAction({ deps: t });
    assert.notInclude('kittens', (await t.git.branchLocal()).all);
  });

  it('prompts and aborts on unmerged branch', async () => {
    await startAction({ deps: t, args: ['kittens'], opts: {} });
    await t.changeSomething();
    await t.git.commit('changed', ['README']);
    t.forceBool = false;
    const err = await assert.rejects(doneAction({ deps: t }));
    assert.include("unmerged feature branch 'kittens'", err.message);
  });

  it('prompts and continues on unmerged branch', async () => {
    await startAction({ deps: t, args: ['kittens'], opts: {} });
    await t.changeSomething();
    await t.git.commit('changed', ['README']);
    t.forceBool = true;
    await doneAction({ deps: t });
    assert.notInclude('kittens', (await t.git.branchLocal()).all);
  });
});
