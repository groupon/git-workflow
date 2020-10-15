'use strict';

const assert = require('assertive');

const addHooks = require('./test-common');

describe('cli', () => {
  for (const main of ['main', 'master']) {
    describe(`with ${main} branch`, () => {
      const t = addHooks(main);

      it('runs setup', async () => {
        await t.cli('setup');
        assert.include('hotfix', (await t.ghGit.branchLocal()).all);
      });

      it('shows errors', async () => {
        const err = await assert.rejects(t.cli('qa', 'tofu'));
        assert.include("'tofu' did not match", err.message);
      });

      it('rejects --yes --no', async () => {
        const err = await assert.rejects(t.cli('setup', '--yes', '--no'));
        assert.include('exclusive', err.message);
      });

      it('forces "yes" response with --yes', async () => {
        await t.cli('start', 'kittens');
        await t.changeSomething();
        await t.git.commit('changed', ['README']);
        await t.cli('done', '--yes');
        assert.notInclude('kittens', (await t.ghGit.branchLocal()).all);
      });

      it('forces "no" response with --no', async () => {
        await t.cli('start', 'kittens');
        await t.changeSomething();
        await t.git.commit('changed', ['README']);
        const err = await assert.rejects(t.cli('done', '--no'));
        assert.include('unmerged', err.message);
        assert.include('kittens', (await t.git.branchLocal()).all);
      });
    });
  }
});
