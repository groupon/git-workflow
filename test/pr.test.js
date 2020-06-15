'use strict';

const URL = require('url');
const { basename, dirname } = require('path');

const assert = require('assertive');

const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: startAction } = require('../lib/commands/start');
const { action: prAction } = require('../lib/commands/pr');

function extractURL(logs) {
  return URL.parse(logs.match(/^Opening (https:\S+)/m)[1], true);
}

async function setupForPR(t, msgs, prOpts = {}) {
  await verifySetup('pr', t);
  await startAction({ deps: t, args: ['kittens-are-cute'], opts: {} });
  for (const msg of msgs) {
    await t.changeSomething();
    await t.git.commit(`${msg}\n\nsome msg\n`, ['README']);
  }
  const opts = {
    parent: { open: false },
    ...prOpts,
  };
  await prAction({ deps: t, opts });
  return extractURL(t.logged);
}

describe('pr', () => {
  const t = addHooks();
  it('infers parent branch and crafts a PR URL', async () => {
    const url = await setupForPR(t, ['docs: added a kitten']);
    assert.include(
      'path has the proper comparison',
      'compare/master...jdoe/feature/master/kittens-are-cute',
      url.pathname
    );
    assert.equal(
      'title has nlm-prefix-stripped commit msg',
      'added a kitten',
      url.query.title
    );
    assert.include('body has the commit msg body', 'some msg', url.query.body);
  });

  it('uses branch name as title for multi-commit PRs', async () => {
    const url = await setupForPR(t, [
      'fix: added kitten 1',
      'fix: added kitten 2',
    ]);
    assert.equal(
      'title has cleaned up branch name',
      'kittens are cute',
      url.query.title
    );
    assert.include(
      'body has list of commit subjects',
      '* fix: added kitten 1\n* fix: added kitten 2\n',
      url.query.body
    );
  });

  it('respects the contents of a PULL_REQUEST_TEMPLATE', async () => {
    const url = await setupForPR(t, ['feat: use a PR template']);
    assert.include(
      'contents of a PULL_REQUEST_TEMPLATE.md file',
      "Please ensure you adequately describe both the problem you're solving for",
      url.query.body
    );
  });

  it('optionally ignores PULL_REQUEST_TEMPLATE', async () => {
    const url = await setupForPR(t, ['feat: use a PR template'], {
      ignorePrTemplate: true,
    });
    assert.notInclude(
      'contents of the PULL REQUEST TEMPLATE are not present',
      "Please ensure you adequately describe both the problem you're solving for",
      url.query.body
    );
  });

  it('uses nlm prefixes to pick a title', async () => {
    const url = await setupForPR(t, [
      'feat: the important bit',
      'docs: added kitten 2',
    ]);
    assert.equal(
      'title has important subject',
      'the important bit',
      url.query.title
    );
  });

  it('dies with pretty error on out-of-date push', async () => {
    await verifySetup('pr', t);
    await startAction({ deps: t, args: ['kittens-are-cute'], opts: {} });
    await t.git2.fetch();
    await t.git2.checkout(`${t.user}/feature/master/kittens-are-cute`);
    await Promise.all([t.changeSomething(), t.changeSomething2()]);
    await Promise.all([
      t.git.commit('one', ['README']),
      t.git2.commit('two', ['README']),
    ]);
    await t.git2.push();
    const err = await assert.rejects(
      prAction({ deps: t, opts: { parent: { open: false } } })
    );
    assert.include('local repo is out-of-date', err.message);
  });

  describe('on a feature branch on a fork', () => {
    beforeEach(() => {
      t.git = t.gitFork;
      t.changeSomething = t.changeSomethingFork;
    });

    it('infers parent branch and crafts a PR URL from fork', async () => {
      const url = await setupForPR(t, ['docs: added a kitten']);
      const prefix = basename(dirname(t.forkDir));
      assert.include(
        'path has the proper comparison',
        `compare/master...${prefix}:feature/master/kittens-are-cute`,
        url.pathname
      );
      assert.include(
        'body has the footer url',
        'https://github.com/groupon/git-workflow/releases/tag/v',
        url.query.body
      );
    });
  });
});
