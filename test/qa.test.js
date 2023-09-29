'use strict';

const assert = require('assert');
const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: qaAction } = require('../lib/commands/qa');

describe('qa', () => {
  for (const main of ['main', 'master']) {
    describe(`with ${main} branch`, () => {
      const t = addHooks(main);
      it('tags an implicit hotfix build', async () => {
        await verifySetup('qa', t); // make our release & hotfix branches

        // put an extra commit onto hotfix branch
        await t.git.checkout('hotfix');
        await t.changeSomething();
        await t.git.commit('hotfix change', ['README']);
        await qaAction({
          deps: t,
          opts: {
            mergeBack: true,
          },
          args: [],
        });
        assert.strictEqual(
          (await t.ghGit.tags()).all.some(tag => /^build-\d/.test(tag)),
          true
        );
      });
      it('tags an explicit release build, merging back', async () => {
        await verifySetup('qa', t);
        await t.git.checkout('release');
        await t.changeSomething();
        await t.git.commit('release change', ['README']);
        await t.git.checkout(main);
        assert.strictEqual((await t.git.log([`${main}..release`])).total, 1);
        await qaAction({
          deps: t,
          args: ['release'],
          opts: {
            mergeBack: true,
          },
          main,
        });
        assert.strictEqual(
          (await t.git.log([`${main}..release`])).total,
          0,
          'no unmerged commits locally'
        );
        assert.strictEqual(
          (await t.ghGit.log([`${main}..release`])).total,
          0,
          'no unmerged commits on remote'
        );
        assert.strictEqual(
          (await t.ghGit.tags()).all.some(tag => /^build-\d/.test(tag)),
          true
        );
      });
    });
  }
});
