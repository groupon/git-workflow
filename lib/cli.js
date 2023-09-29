/*
 * Copyright (c) 2019, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const fs = require('fs');
const prog = require('commander');
const git = require('simple-git').simpleGit();

const verifySetup = require('./setup');
const { UIError, log } = require('./common');

let ranAction = false;

/**
 * @param {string} cmd
 * @param {import('./typedefs').ActionFn} fn
 * @return {(...args: any[]) => void}
 */
function wrapAction(cmd, fn) {
  /** @type {import('./typedefs').CmdDeps} */
  const deps = { git, log };
  return (...args) => {
    ranAction = true;
    /** @type {import('./typedefs').CmdOpts} */
    const opts = args.pop();
    if (opts.parent.yes) {
      deps.forceBool = true;
      if (opts.parent.no) {
        throw new UIError('--yes and --no are mutually exclusive');
      }
    }
    if (opts.parent.no) deps.forceBool = false;
    verifySetup(cmd, deps)
      .then(main => fn({ deps, opts, args, main }))
      .catch(
        /** @param {Error} err */ err => {
          const justMessage = !err.stack || err instanceof UIError;
          // eslint-disable-next-line no-console
          console.error(`🚢💥 ${justMessage ? err.message : err.stack}`);
          process.exit(1);
        }
      );
  };
}

prog
  .version(require('../package.json').version)
  .option('-O, --no-open', 'Never auto-open URLs in the browser')
  .option('--yes', 'Answer yes to all yes/no prompts')
  .option('--no', 'Answer no to all yes/no prompts');

fs.readdirSync(`${__dirname}/commands`).forEach(file => {
  const m = file.match(/^([^.].*)\.js$/);
  if (m) {
    // eslint-disable-next-line import/no-dynamic-require
    require(`./commands/${file}`).command(prog, wrapAction.bind(null, m[1]));
  }
});

prog
  .command('setup')
  .description('Verifies your branch setup')
  .action(wrapAction('setup', () => {}));

prog.parse(process.argv);

if (!ranAction) prog.help();
