'use strict';

const assert = require('assert');
const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: mergeBackAction } = require('../lib/commands/merge-back');

async function assertMergedBack(git, main) {
  assert.deepStrictEqual(
    (await git.log(['release..hotfix'])).all,
    [],
    'no unmerged release ← hotfix commits'
  );
  assert.deepStrictEqual(
    (await git.log([`${main}..release`])).all,
    [],
    `no unmerged ${main} ← release commits`
  );
}
async function getReleaseCommit(git) {
  const res = await git.branchLocal();
  return res.branches.release.commit;
}
describe('merge-back', () => {
  for (const main of ['main', 'master']) {
    describe(`with ${main} branch`, () => {
      const t = addHooks(main);
      it('merges changes back automatically', async () => {
        await verifySetup('merge-back', t); // make our release & hotfix branches

        // put an unmerged commit on release and a non-conflicting one on main
        await t.git.checkout('release');
        await t.changeSomething();
        await t.git.commit('unmerged release change', ['README']);
        await t.git.push();
        const releaseCommit = await getReleaseCommit(t.git);
        await t.git.checkout(main);
        await t.changeSomething('another-file');
        await t.git.add(['.']);
        await t.git.commit(`unmerged ${main} change`);
        await t.git.push();
        await mergeBackAction({
          deps: t,
          main,
        });

        // make sure everything got merged back
        await assertMergedBack(t.ghGit, main);

        // and that we didn't need to change release
        assert.strictEqual(await getReleaseCommit(t.git), releaseCommit);
      });
      it('tries to merges back and starts a feature branch on conflict', async () => {
        await verifySetup('merge-back', t);
        for (const branch of ['hotfix', 'release']) {
          await t.git.checkout(branch);
          await t.changeSomething();
          await t.git.commit(`conflicting ${branch} change`, ['README']);
          await t.git.push();
        }
        await assert.rejects(
          mergeBackAction({ deps: t, main }),
          /When conflicts are resolved/
        );
        const branches = await t.ghGit.branchLocal();
        assert.match(branches.all, /jdoe\/feature\/release\/merge-hotfix/);
        assert.ok(!branches.all.includes(`jdoe/feature/${main}/merge-release`));
      });
    });
  }
});
