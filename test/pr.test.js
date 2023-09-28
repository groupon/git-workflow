'use strict';

const assert = require('assert');
const URL = require('url');
const { basename, dirname } = require('path');
const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: startAction } = require('../lib/commands/start');
const { action: prAction } = require('../lib/commands/pr');
const { writeFileSync, mkdirSync } = require('fs');

function extractURL(logs) {
  return URL.parse(logs.match(/^Opening (https:\S+)/m)[1], true);
}
async function setupForPR(t, msgs, prOpts = {}) {
  await verifySetup('pr', t);
  await startAction({
    deps: t,
    args: ['kittens-are-cute'],
    opts: {},
  });
  for (const msg of msgs) {
    await t.changeSomething();
    await t.git.commit(`${msg}\n\nsome msg\n`, ['README']);
  }
  const opts = {
    parent: {
      open: false,
    },
    ...prOpts,
  };
  await prAction({
    deps: t,
    opts,
  });
  return extractURL(t.logged);
}
describe('pr', () => {
  const t = addHooks();
  it('infers parent branch and crafts a PR URL', async () => {
    const url = await setupForPR(t, ['docs: added a kitten']);
    assert.match(
      url.pathname,
      /compare\/master\.\.\.jdoe\/feature\/master\/kittens-are-cute/,
      'path has the proper comparison'
    );
    assert.strictEqual(
      url.query.title,
      'added a kitten',
      'title has nlm-prefix-stripped commit msg'
    );
    assert.match(url.query.body, /some msg/, 'body has the commit msg body');
  });
  it('uses branch name as title for multi-commit PRs', async () => {
    const url = await setupForPR(t, [
      'fix: added kitten 1',
      'fix: added kitten 2',
    ]);
    assert.strictEqual(
      url.query.title,
      'kittens are cute',
      'title has cleaned up branch name'
    );
    assert.match(
      url.query.body,
      /\* fix: added kitten 1\n\* fix: added kitten 2\n/,
      'body has list of commit subjects'
    );
  });
  it('respects the contents of a PULL_REQUEST_TEMPLATE', async () => {
    writeFileSync('PULL_REQUEST_TEMPLATE.md', 'Important stuff');
    const url = await setupForPR(t, ['feat: use a PR template']);
    assert.match(
      url.query.body,
      /Important stuff/,
      'contents of a PULL_REQUEST_TEMPLATE.md file'
    );
  });
  it('respects the contents of a .github/pull_request_template', async () => {
    mkdirSync('.github');
    writeFileSync('.github/pull_request_template.md', 'Other stuff');
    const url = await setupForPR(t, ['feat: use a PR template']);
    assert.match(
      url.query.body,
      /Other stuff/,
      'contents of a pull_request_template.md file'
    );
  });
  it('optionally ignores PULL_REQUEST_TEMPLATE', async () => {
    writeFileSync('PULL_REQUEST_TEMPLATE.md', 'Important stuff');
    const url = await setupForPR(t, ['feat: use a PR template'], {
      ignorePrTemplate: true,
    });
    assert.ok(
      !url.query.body.includes('Important stuff'),
      'contents of the PULL REQUEST TEMPLATE are not present'
    );
  });
  it('uses nlm prefixes to pick a title', async () => {
    const url = await setupForPR(t, [
      'feat: the important bit',
      'docs: added kitten 2',
    ]);
    assert.strictEqual(
      url.query.title,
      'the important bit',
      'title has important subject'
    );
  });
  it('dies with pretty error on out-of-date push', async () => {
    await verifySetup('pr', t);
    await startAction({
      deps: t,
      args: ['kittens-are-cute'],
      opts: {},
    });
    await t.git2.fetch();
    await t.git2.checkout(`${t.user}/feature/master/kittens-are-cute`);
    await Promise.all([t.changeSomething(), t.changeSomething2()]);
    await Promise.all([
      t.git.commit('one', ['README']),
      t.git2.commit('two', ['README']),
    ]);
    await t.git2.push();
    await assert.rejects(
      prAction({
        deps: t,
        opts: { parent: { open: false } },
      }),
      /local repo is out-of-date/
    );
  });
  describe('on a feature branch on a fork', () => {
    beforeEach(() => {
      t.git = t.gitFork;
      t.changeSomething = t.changeSomethingFork;
    });
    it('infers parent branch and crafts a PR URL from fork', async () => {
      const url = await setupForPR(t, ['docs: added a kitten']);
      const prefix = basename(dirname(t.forkDir));
      assert.ok(
        url.pathname.includes(
          `compare/master...${prefix}:feature/master/kittens-are-cute`
        ),
        'path has the proper comparison'
      );
      assert.match(
        url.query.body,
        /https:\/\/github\.com\/groupon\/git-workflow\/releases\/tag\/v/,
        'body has the footer url'
      );
    });
  });
});
