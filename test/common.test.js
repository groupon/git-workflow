'use strict';

const assert = require('assertive');

const { action: startAction } = require('../lib/commands/start');

const addHooks = require('./test-common');
const common = require('../lib/common');

describe('common', () => {
  const t = addHooks();

  describe('featureParent()', () => {
    it('finds a parent from a local branch name', async () => {
      await startAction(t, 'kittens');
      const { parent, remote } = await common.featureParent(t.git, 'kittens');
      assert.equal('master', parent);
      assert.equal('origin', remote);
    });

    it('fails on non-started branch', async () => {
      await t.git.checkoutLocalBranch('kittens');
      const err = await assert.rejects(common.featureParent(t.git, 'kittens'));
      assert.include('not a feature', err.message);
    });

    describe('with a feature on a fork', () => {
      beforeEach(() => (t.git = t.gitFork));

      it('finds a parent from a local branch name', async () => {
        await startAction(t, 'kittens');
        const { remote, parent } = await common.featureParent(t.git, 'kittens');
        assert.equal('fork', remote);
        assert.equal('master', parent);
      });
    });
  });

  describe('plural()', () => {
    it('returns the singular', () => {
      assert.equal('1 thing', common.plural(1, 'thing'));
    });

    it('returns the default plural', () => {
      assert.equal('2 things', common.plural(2, 'thing'));
    });

    it('returns a custom plural', () => {
      assert.equal('2 daveses', common.plural(2, 'dave', 'daveses'));
    });
  });

  describe('gitConfig()', () => {
    it('returns config as a nested tree', async () => {
      const cfg = await common.gitConfig(t.git);
      assert.equal(t.ghDir, cfg.remote.origin.url);
    });

    it('returns config as flat object', async () => {
      const cfg = await common.gitConfig(t.git, true);
      assert.equal(t.ghDir, cfg['remote.origin.url']);
    });
  });

  describe('ghURL()', () => {
    it('infers a github url from a repo', async () => {
      await startAction(t, 'kittens');
      await t.git.addConfig('remote.origin.url', 'git@github.com:foo/bar.git');
      assert.equal(
        'https://github.com/foo/bar/xyz?a=42',
        await common.ghURL(t.git, '/xyz', { a: 42 })
      );
    });
  });
});
