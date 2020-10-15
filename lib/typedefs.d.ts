export type CmdDeps = {
  git: import('simple-git/promise').SimpleGit;
  log(msg: string): void;
  forceBool?: boolean;
};

export type CmdOpts = {
  parent: {
    open?: boolean;
    yes?: boolean;
    no?: boolean;
  };
  [opt: string]: any;
};

export type MainBranch = 'main' | 'master';

export type ActionFn = (allArgs: {
  deps: CmdDeps;
  opts: CmdOpts;
  args: string[];
  main: MainBranch;
}) => void | Promise<void>;

export type WrapActionFn = (action: ActionFn) => (...args: any[]) => void;

export type Action = {
  action: ActionFn;
  command(
    prog: import('commander').CommanderStatic,
    wrapAction: WrapActionFn
  ): void;
};
