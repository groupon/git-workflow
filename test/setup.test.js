'use strict';

const assert = require('assert');
const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');

describe('verifySetup', () => {
  for (const main of ['main', 'master']) {
    describe(`with ${main} branch`, () => {
      const t = addHooks(main);
      it('creates and pushes missing release & hotfix branches', async () => {
        await verifySetup('setup', t);
        const repoBranches = await Promise.all(
          ['git', 'ghGit'].map(git => t[git].branchLocal())
        );
        for (const name of ['release', 'hotfix']) {
          for (const repo of repoBranches) {
            assert.ok(repo.all.includes(name));
          }
        }
      });
    });
  }
});
