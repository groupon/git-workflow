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

const { execFile } = require('child_process');
const { promisify } = require('util');
const open = require('open');

const packageJSON = require('../package.json');

const execFileAsync = promisify(execFile);

/**
 * @typedef {import('simple-git').SimpleGit} SimpleGit
 */

class UIError extends Error {}
exports.UIError = UIError;

/**
 * @param {boolean} [md]
 */
function cmdLine(md = false) {
  const bin = Object.keys(packageJSON.bin)[0];
  const cl = `${bin} ${process.argv.slice(2).join(' ')}`.replace(
    /^git-/,
    'git '
  );
  if (!md) return cl;
  const baseUrl = packageJSON.repository.url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '');
  return `[${cl}](${baseUrl}/releases/tag/v${packageJSON.version})`;
}
exports.cmdLine = cmdLine;

/**
 * @param {string} msg
 */
function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`🚢  ${msg}`);
}
exports.log = log;

/**
 * @param {SimpleGit} git
 * @param {string} branch
 */
async function featureParent(git, branch) {
  const cfg = await exports.gitConfig(git);
  let parent;
  let remote;
  try {
    remote = cfg[`branch.${branch}.remote`];
    const parts = cfg[`branch.${branch}.merge`].split('/');
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
  return { remote, parent: decodeBranch(parent) };
}

exports.featureParent = featureParent;

function ghUser() {
  return process.env.GH_USER || process.env.USER;
}
exports.ghUser = ghUser;

/**
 * @param {string} feature
 * @param {string} parent
 * @param {boolean} onFork
 */
function remoteFromLocal(feature, parent, onFork) {
  const prefix = onFork ? '' : `${ghUser()}/`;
  return `${prefix}feature/${encodeBranch(parent)}/${feature}`;
}
exports.remoteFromLocal = remoteFromLocal;

/**
 * If you are already on a wf-managed branch, e.g. feature/main/foo_bar
 * and you want to start a new branch e.g. "baz", we need to encode it,
 * so you'll end up with feature/feature_2fmain_2ffoo_5fbar/baz
 * (hex ascii codes for _-escaped characters)
 * ugly, but effective (could scale to encoding any incompatible char)
 *
 * @param {string} branch
 */
function encodeBranch(branch) {
  return branch.replace(/_/g, '_5f').replace(/\//g, '_2f');
}
exports.encodeBranch = encodeBranch;

/** @param {string} branch */
function decodeBranch(branch) {
  return decodeURIComponent(branch.replace(/_/g, '%'));
}
exports.decodeBranch = decodeBranch;

/**
 * @param {number} n
 * @param {string} thing
 * @param {string} [pluralThing]
 */
function plural(n, thing, pluralThing = `${thing}s`) {
  return `${n} ${n === 1 ? thing : pluralThing}`;
}
exports.plural = plural;

/**
 * @param {string} question
 * @param {boolean} def
 * @param {boolean} [forceBool]
 */
function yesNo(question, def, forceBool) {
  if (forceBool != null) return Promise.resolve(forceBool);

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
      resolve(answer === '' ? def : /^\s*y/i.test(answer));
    });
  });
}
exports.yesNo = yesNo;

// TODO: PR this to simple-git as "config"

/**
 * @param {SimpleGit} git
 * @return {Promise<{ [key: string]: string }>}
 */
async function gitConfig(git) {
  const rawCfg = await git.raw(['config', '--list', '--null']);
  return rawCfg.split('\0').reduce((o, pair) => {
    const [key, val] = pair.split('\n');
    return { ...o, [key]: val };
  }, {});
}

exports.gitConfig = gitConfig;

/**
 * @param {string} host
 */
function expandSSHHostname(host) {
  return execFileAsync('ssh', ['-G', host])
    .then(({ stdout }) => {
      if (!stdout) throw new Error('ssh failed');
      const hnMatch = stdout.match(/^hostname\s+(\S+)/m);
      if (!hnMatch) throw new Error("Couldn't find hostname in ssh output");
      return hnMatch[1];
    })
    .catch(err => {
      debug('expandSSHHostname', err);
      return host;
    });
}

/**
 * @param {string} url
 */
function parseGHRemote(url) {
  const m = url.match(
    /^(?:[a-z+]+:\/\/)?(?:git@)?([^/:]*)[/:](?:[^/]+\/)*([^/]+)\/([^/]+?)(?:\.git)?$/
  );
  if (!m) throw new UIError(`Failed to parse github remote: ${url}`);
  const [, host, owner, repo] = m;
  return { host, owner, repo };
}

/**
 * @param {SimpleGit} git
 * @param {string} path
 * @param {{ [key: string]: any }} [query]
 */
async function ghURL(git, path, query = {}) {
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

/**
 * @param {SimpleGit} git
 */
function repoRootDir(git) {
  return git.revparse(['--show-toplevel']);
}
exports.repoRootDir = repoRootDir;

/**
 * @param {SimpleGit} git
 * @param {boolean} [forceFork]
 * @param {boolean} [openURLs]
 */
async function inferRemote(git, forceFork = false, openURLs = false) {
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
  } catch (/** @type {any} */ err) {
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
  throw new Error('not reached');
}
exports.inferRemote = inferRemote;

/**
 * @param {SimpleGit} git
 * @param {string} cmdName
 */
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
