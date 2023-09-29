'use strict';

const assert = require('assert');
const addHooks = require('./test-common');

describe('cli', () => {
  for (const main of ['main', 'master']) {
    describe(`with ${main} branch`, () => {
      const t = addHooks(main);
      it('runs setup', async () => {
        await t.cli('setup');
        assert.ok((await t.ghGit.branchLocal()).all.includes('hotfix'));
      });
      it('shows errors', async () => {
        await assert.rejects(t.cli('qa', 'tofu'), /'tofu' did not match/);
      });
      it('rejects --yes --no', async () => {
        await assert.rejects(t.cli('setup', '--yes', '--no'), /exclusive/);
      });
      it('forces "yes" response with --yes', async () => {
        await t.cli('start', 'kittens');
        await t.changeSomething();
        await t.git.commit('changed', ['README']);
        await t.cli('done', '--yes');
        assert.ok(!(await t.ghGit.branchLocal()).all.includes('kittens'));
      });
      it('forces "no" response with --no', async () => {
        await t.cli('start', 'kittens');
        await t.changeSomething();
        await t.git.commit('changed', ['README']);
        await assert.rejects(t.cli('done', '--no'), /unmerged/);
        assert.ok((await t.git.branchLocal()).all.includes('kittens'));
      });
    });
  }
});
