'use strict';

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
