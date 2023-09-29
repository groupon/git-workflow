'use strict';

const assert = require('assert');
const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: hotfixAction } = require('../lib/commands/hotfix');

describe('hotfix', () => {
  const t = addHooks();
  it('pulls, moves, and pushes hotfix branch', async () => {
    await verifySetup('hotfix', t); // otherwise we're just testing setup

    const tag = 'build-2020.02.02_02.02.02';
    await t.changeSomething();
    await t.git.commit('changes for next release', ['README']);
    await t.git.push();
    await t.git.tag([tag]);
    await t.git.pushTags('origin');
    const prevBranches = await t.ghGit.branchLocal();
    assert.notStrictEqual(
      prevBranches.branches.hotfix.commit,
      prevBranches.branches.master.commit
    );
    await hotfixAction({
      deps: t,
      args: [tag],
    });
    const branches = await t.ghGit.branchLocal();
    assert.strictEqual(
      branches.branches.hotfix.commit,
      branches.branches.master.commit
    );
  });
});
