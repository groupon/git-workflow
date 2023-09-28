'use strict';

const assert = require('assert');
const { action: startAction } = require('../lib/commands/start');
const addHooks = require('./test-common');
const common = require('../lib/common');

describe('common', () => {
  const t = addHooks();
  describe('featureParent()', () => {
    it('finds a parent from a local branch name', async () => {
      await startAction({
        deps: t,
        args: ['kittens'],
        opts: {},
      });
      const { parent, remote } = await common.featureParent(t.git, 'kittens');
      assert.strictEqual(parent, 'master');
      assert.strictEqual(remote, 'origin');
    });
    it('fails on non-started branch', async () => {
      await t.git.checkoutLocalBranch('kittens');
      await assert.rejects(
        common.featureParent(t.git, 'kittens'),
        /not a feature/
      );
    });
    describe('with a feature on a fork', () => {
      beforeEach(() => (t.git = t.gitFork));
      it('finds a parent from a local branch name', async () => {
        await startAction({
          deps: t,
          args: ['kittens'],
          opts: {},
        });
        const { remote, parent } = await common.featureParent(t.git, 'kittens');
        assert.strictEqual(remote, 'fork');
        assert.strictEqual(parent, 'master');
      });
    });
  });
  describe('plural()', () => {
    it('returns the singular', () => {
      assert.strictEqual(common.plural(1, 'thing'), '1 thing');
    });
    it('returns the default plural', () => {
      assert.strictEqual(common.plural(2, 'thing'), '2 things');
    });
    it('returns a custom plural', () => {
      assert.strictEqual(common.plural(2, 'dave', 'daveses'), '2 daveses');
    });
  });
  describe('gitConfig()', () => {
    it('returns config as flat object', async () => {
      const cfg = await common.gitConfig(t.git, true);
      assert.strictEqual(cfg['remote.origin.url'], t.ghDir);
    });
  });
  describe('ghURL()', () => {
    it('infers a github url from a repo', async () => {
      await startAction({
        deps: t,
        args: ['kittens'],
        opts: {},
      });
      await t.git.addConfig('remote.origin.url', 'git@github.com:foo/bar.git');
      assert.strictEqual(
        await common.ghURL(t.git, '/xyz', {
          a: 42,
        }),
        'https://github.com/foo/bar/xyz?a=42'
      );
    });
  });
});
