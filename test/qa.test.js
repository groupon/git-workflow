'use strict';

const assert = require('assertive');

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

        await qaAction({ deps: t, opts: { mergeBack: true }, args: [] });

        assert.expect(
          (await t.ghGit.tags()).all.some(tag => /^build-\d/.test(tag))
        );
      });

      it('tags an explicit release build, merging back', async () => {
        await verifySetup('qa', t);

        await t.git.checkout('release');
        await t.changeSomething();
        await t.git.commit('release change', ['README']);
        await t.git.checkout(main);

        assert.equal(1, (await t.git.log([`${main}..release`])).total);

        await qaAction({
          deps: t,
          args: ['release'],
          opts: { mergeBack: true },
          main,
        });

        assert.equal(
          'no unmerged commits locally',
          0,
          (await t.git.log([`${main}..release`])).total
        );
        assert.equal(
          'no unmerged commits on remote',
          0,
          (await t.ghGit.log([`${main}..release`])).total
        );
        assert.expect(
          (await t.ghGit.tags()).all.some(tag => /^build-\d/.test(tag))
        );
      });
    });
  }
});
