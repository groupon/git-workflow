'use strict';

const assert = require('assertive');

const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: mergeBackAction } = require('../lib/commands/merge-back');

async function assertMergedBack(git) {
  assert.deepEqual(
    'no unmerged release ← hotfix commits',
    [],
    (await git.log(['release..hotfix'])).all
  );
  assert.deepEqual(
    'no unmerged master ← release commits',
    [],
    (await git.log(['master..release'])).all
  );
}

async function getReleaseCommit(git) {
  const res = await git.branchLocal();
  return res.branches.release.commit;
}

describe('merge-back', () => {
  const t = addHooks();

  it('merges changes back automatically', async () => {
    await verifySetup('merge-back', t); // make our release & hotfix branches

    // put an unmerged commit on release and a non-conflicting one on master
    await t.git.checkout('release');
    await t.changeSomething();
    await t.git.commit('unmerged release change', ['README']);
    await t.git.push();
    const releaseCommit = await getReleaseCommit(t.git);

    await t.git.checkout('master');
    await t.changeSomething('another-file');
    await t.git.add(['.']);
    await t.git.commit('umerged master change');
    await t.git.push();

    await mergeBackAction(t);

    // make sure everything got merged back
    await assertMergedBack(t.ghGit);

    // and that we didn't need to change release
    assert.equal(releaseCommit, await getReleaseCommit(t.git));
  });

  it('tries to merges back and starts a feature branch on conflict', async () => {
    await verifySetup('merge-back', t);

    for (const branch of ['hotfix', 'release']) {
      await t.git.checkout(branch);
      await t.changeSomething();
      await t.git.commit(`conflicting ${branch} change`, ['README']);
      await t.git.push();
    }

    const err = await assert.rejects(mergeBackAction(t));
    assert.include('When conflicts are resolved', err.message);

    const branches = await t.ghGit.branchLocal();
    assert.include('jdoe/feature/release/merge-hotfix', branches.all);
    assert.notInclude('jdoe/feature/master/merge-release', branches.all);
  });
});
