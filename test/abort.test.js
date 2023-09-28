'use strict';

const assert = require('assert');
const addHooks = require('./test-common');
const { action: startAction } = require('../lib/commands/start');
const { action: abortAction } = require('../lib/commands/abort');

describe('abort', () => {
  const t = addHooks();
  it('aborts a feature branch with no local changes', async () => {
    await startAction({
      deps: t,
      args: ['kittens'],
      opts: {},
    });
    const headSHA = (await t.git.revparse(['HEAD'])).trim();
    await abortAction({
      deps: t,
    });
    assert.ok(!(await t.git.branchLocal()).all.includes('kittens'));
    assert.ok(t.logged.includes(headSHA), 'SHA has not changed');
  });
  it('aborts a feature branch with local changes', async () => {
    await startAction({
      deps: t,
      args: ['kittens'],
      opts: {},
    });
    const headSHA = (await t.git.revparse(['HEAD'])).trim();
    await t.changeSomething();
    await abortAction({
      deps: t,
    });
    assert.ok(!(await t.git.branchLocal()).all.includes('kittens'));
    const [, finalSHA] = t.logged.match(/last SHA was (\S+)/);
    assert.notStrictEqual(finalSHA, headSHA);
  });
});
