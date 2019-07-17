'use strict';

const assert = require('assertive');

const addHooks = require('./test-common');
const { action: startAction } = require('../lib/commands/start');
const { action: renameAction } = require('../lib/commands/rename');

describe('rename', () => {
  const t = addHooks();

  it('renames current branch to a new name', async () => {
    await startAction({ deps: t, args: ['kittens'], opts: {} });
    await t.changeSomething();
    await t.git.commit('blah', ['README']);
    await renameAction({ deps: t, args: ['puppies'] });
    const { branches } = await t.git.branch(['-vv']);
    assert.falsey(branches.kittens);
    assert.include(
      'origin/jdoe/feature/master/puppies: ahead 1',
      branches.puppies.label
    );
  });
});
