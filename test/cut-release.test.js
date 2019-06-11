'use strict';

const assert = require('assertive');

const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');

const { action: cutReleaseAction } = require('../lib/commands/cut-release');

describe('cut-release', () => {
  const t = addHooks();

  it('opens a master → release PR url', async () => {
    await verifySetup('cut-release', t); // need branches to merge back
    await cutReleaseAction(t, null, { parent: { open: false } });
    assert.include('/compare/release...master?', t.logged);
  });

  it('refuses to run on a checkout with a fork', async () => {
    t.git = t.gitFork;
    const err = await assert.rejects(
      cutReleaseAction(t, null, { parent: { open: false } })
    );
    assert.include('with a fork remote', err.message);
  });
});
