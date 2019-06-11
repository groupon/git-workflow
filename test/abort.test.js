'use strict';

const assert = require('assertive');

const addHooks = require('./test-common');
const { action: startAction } = require('../lib/commands/start');
const { action: abortAction } = require('../lib/commands/abort');

describe('abort', () => {
  const t = addHooks();
  it('aborts a feature branch with no local changes', async () => {
    await startAction(t, 'kittens');
    const headSHA = (await t.git.revparse(['HEAD'])).trim();
    await abortAction(t);
    assert.notInclude('kittens', (await t.git.branchLocal()).all);
    assert.include('SHA has not changed', headSHA, t.logged);
  });

  it('aborts a feature branch with local changes', async () => {
    await startAction(t, 'kittens');
    const headSHA = (await t.git.revparse(['HEAD'])).trim();
    await t.changeSomething();
    await abortAction(t);
    assert.notInclude('kittens', (await t.git.branchLocal()).all);
    const [, finalSHA] = t.logged.match(/last SHA was (\S+)/);
    assert.notEqual(headSHA, finalSHA);
  });
});
