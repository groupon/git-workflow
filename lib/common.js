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

const URL = require('url');
const readline = require('readline');

const debug = require('debug')('workflow:common');

const set = require('lodash/set');
const { execFile } = require('child_process');
const { promisify } = require('util');
const open = require('open');

const packageJSON = require('../package.json');

const execFileAsync = promisify(execFile);

class UIError extends Error {}
exports.UIError = UIError;

function cmdLine(md) {
  const bin = Object.keys(packageJSON.bin)[0];
  const cl = `${bin} ${process.argv.slice(2).join(' ')}`.replace(
    /^git-/,
    'git '
  );
  if (!md) return cl;
  const baseUrl = packageJSON.repository.url
    .replace(/^git\+/)
    .replace(/\.git$/);
  return `[${cl}](${baseUrl}/releases/tag/v${packageJSON.version})`;
}
exports.cmdLine = cmdLine;

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`🚢  ${msg}`);
}
exports.log = log;

async function featureParent(git, branch) {
  const cfg = await exports.gitConfig(git);
  let parent;
  let remote;
  try {
    remote = cfg.branch[branch].remote;
    const parts = cfg.branch[branch].merge.split('/');
    if (remote === 'origin') parent = parts.slice(4, -1).join('/');
    else if (remote === 'fork') parent = parts.slice(3, -1).join('/');
  } catch (err) {
    /* */
  }
  if (!parent) {
    throw new UIError(
      `Couldn't find parent for branch '${branch}' - not a feature branch?`
    );
  }
  return { remote, parent };
}

exports.featureParent = featureParent;

function ghUser() {
  return process.env.GH_USER || process.env.USER;
}
exports.ghUser = ghUser;

function remoteFromLocal(feature, parent, onFork) {
  return `${onFork ? '' : `${ghUser()}/`}feature/${parent}/${feature}`;
}
exports.remoteFromLocal = remoteFromLocal;

function plural(n, thing, pluralThing) {
  return `${n} ${n === 1 ? thing : pluralThing || `${thing}s`}`;
}
exports.plural = plural;

function prompt(question, def, forceBool) {
  const boolAnswer = 'boolean' === typeof def;

  if (boolAnswer && forceBool != null) return Promise.resolve(forceBool);

  if (def == null) {
    if (!process.stderr.isTTY) {
      throw new Error(
        `Needed to ask question "${question}" with no default answer, but have no tty`
      );
    }
  } else {
    if (!process.stderr.isTTY) return Promise.resolve(def);
    if (def === true) question += ' [Y/n]';
    else if (def === false) question += ' [y/N]';
    else if ('string' === typeof def) question += ` [${def}]`;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise(resolve => {
    rl.question(`${question} `, answer => {
      rl.close();
      if (answer === '') answer = def;
      else if (boolAnswer) answer = /^\s*y/i.test(answer);
      resolve(answer);
    });
  });
}
exports.prompt = prompt;

// TODO: PR this to simple-git as "config"

async function gitConfig(git, flat) {
  const rawCfg = await git.raw(['config', '--list', '--null']);
  const config = {};
  rawCfg.split('\0').forEach(pair => {
    const [key, val] = pair.split('\n');

    if (flat) config[key] = val;
    else set(config, key, val);
  });
  return config;
}

exports.gitConfig = gitConfig;

function expandSSHHostname(host) {
  return execFileAsync('ssh', ['-G', host])
    .then(({ stdout }) => stdout.match(/^hostname\s+(\S+)/m)[1])
    .catch(err => {
      debug('expandSSHHostname', err);
      return host;
    });
}

function parseGHRemote(url) {
  const m = url.match(
    /^(?:[a-z+]+:\/\/)?(?:git@)?([^/:]*)[/:](?:[^/]+\/)*([^/]+)\/([^/]+?)(?:\.git)?$/
  );
  if (!m) throw new UIError(`Failed to parse github remote: ${url}`);
  const [, host, owner, repo] = m;
  return { host, owner, repo };
}

async function ghURL(git, path, query) {
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');

  if (!origin) throw new UIError("Couldn't find 'origin' in list of remotes");

  const { host: remoteHost, owner, repo } = parseGHRemote(origin.refs.fetch);

  let host = remoteHost || 'github.com';
  const pathname = `/${owner}/${repo}${path || ''}`;

  if (!/\./.test(host)) {
    debug(`ghURL: looking up real hostname for ${host}`);
    host = await expandSSHHostname(host);
  }

  return URL.format({ host, pathname, protocol: 'https:', query });
}
exports.ghURL = ghURL;

async function inferRemote(git, forceFork, openURLs) {
  const remotes = await git.getRemotes(true);

  // if we already have a remote called "fork", use it
  if (remotes.find(r => r.name === 'fork')) return 'fork';

  const origin = remotes.find(r => r.name === 'origin');
  if (!origin) throw new UIError("Couldn't find 'origin' in list of remotes");

  // if we don't, and we aren't asked to fork, just use origin
  if (!forceFork) return 'origin';

  const { host, owner, repo } = parseGHRemote(origin.refs.fetch);

  const user = ghUser();
  const forkRemote = `git@${host}:${user}/${repo}.git`;

  await git.addRemote('fork', forkRemote);

  try {
    await git.fetch(['fork']);
    log(`Added remote fork -> ${forkRemote}`);
    return 'fork';
  } catch (err) {
    await git.removeRemote('fork').catch(() => {});
    if (!/Repository not found/.test(err.message)) throw err;
  }

  log(
    `You don't seem to have a fork of ${owner}/${repo} named ${user}/${repo}; make one then try this again`
  );
  const forkURL = await ghURL(git, '/fork');
  if (openURLs) open(forkURL);
  else log(forkURL);
  process.exit(1);
  return null;
}
exports.inferRemote = inferRemote;

function assertNoFork(git, cmdName) {
  return inferRemote(git).then(remote => {
    if (remote === 'fork') {
      throw new UIError(
        `You cannot run "git wf ${cmdName}" with a fork remote`
      );
    }
  });
}
exports.assertNoFork = assertNoFork;
