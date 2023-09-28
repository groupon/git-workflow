'use strict';

const assert = require('assert');
const addHooks = require('./test-common');
const verifySetup = require('../lib/setup');
const { action: cutReleaseAction } = require('../lib/commands/cut-release');

describe('cut-release', () => {
  for (const main of ['main', 'master']) {
    describe(`with ${main} branch`, () => {
      const t = addHooks(main);
      it(`opens a ${main} → release PR url`, async () => {
        await verifySetup('cut-release', t); // need branches to merge back
        await cutReleaseAction({
          deps: t,
          args: [],
          opts: {
            parent: {
              open: false,
            },
          },
          main,
        });
        assert.ok(t.logged.includes(`/compare/release...${main}?`));
      });
      it('refuses to run on a checkout with a fork', async () => {
        t.git = t.gitFork;
        await assert.rejects(
          cutReleaseAction({
            deps: t,
            args: [],
            opts: {
              parent: {
                open: false,
              },
            },
            main,
          }),
          /with a fork remote/
        );
      });
    });
  }
});
