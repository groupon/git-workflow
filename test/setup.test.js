'use strict';

const assert = require('assertive');

const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');

describe('verifySetup', () => {
  const t = addHooks();

  it('creates and pushes missing release & hotfix branches', async () => {
    await verifySetup('setup', t);
    const repoBranches = await Promise.all(
      ['git', 'ghGit'].map(git => t[git].branchLocal())
    );
    for (const name of ['release', 'hotfix']) {
      for (const repo of repoBranches) {
        assert.include(name, repo.all);
      }
    }
  });
});
