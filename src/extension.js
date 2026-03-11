const vscode = require('vscode');
const {
  TICK_MS,
  ACTIVE_WINDOW_MS,
  VIEW_IDS
} = require('./constants');
const { createGameState, serializeGameState, resetProgress } = require('./domain/state');
const { viewState } = require('./ui/viewState');
const { loadState, saveState } = require('./storage');
const { getHtml } = require('./views');
const { applyTick } = require('./runtime/tick');
const { createViewStateResolver } = require('./runtime/viewStateResolver');
const { createViewManager, registerFailedProviders } = require('./runtime/viewManager');
const { createMessageHandler } = require('./runtime/messageHandler');

function activate(context) {
  try {
    const state = createGameState(loadState(context));
    const getViewState = createViewStateResolver({ state, viewState, resetProgress });

    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    status.command = 'vscode-idle.focusIdleView';
    status.tooltip = 'Open Idle Game';
    status.show();
    context.subscriptions.push(status);

    function persist() {
      saveState(context, serializeGameState(state));
    }

    function updateStatus() {
      const current = getViewState();
      if (!current) {
        return;
      }
      status.text = `$(flame) ${current.bitsText} bits  x${current.multiplierText}`;
    }

    let handleMessage = () => {};
    const viewManager = createViewManager({
      getHtml,
      onMessage: (message) => handleMessage(message),
      getState: getViewState
    });

    handleMessage = createMessageHandler({
      state,
      persist,
      updateStatus,
      syncAll: viewManager.syncAll,
      resetProgress
    });

    const now = Date.now();
    const offlineSeconds = Math.max(0, (now - state.lastTick) / 1000);
    applyTick(state, offlineSeconds, false);
    state.lastTick = now;

    updateStatus();

    const timer = setInterval(() => {
      const current = Date.now();
      const seconds = Math.max(0, (current - state.lastTick) / 1000);
      const active = current - state.lastInput <= ACTIVE_WINDOW_MS;

      applyTick(state, seconds, active);

      state.lastTick = current;
      updateStatus();
      persist();
      viewManager.syncAll();
    }, TICK_MS);

    context.subscriptions.push({ dispose: () => clearInterval(timer) });

    const inputListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges && event.contentChanges.length > 0) {
        state.lastInput = Date.now();
      }
    });
    context.subscriptions.push(inputListener);

    viewManager.register(vscode, context, VIEW_IDS);

    const focusCommand = vscode.commands.registerCommand('vscode-idle.focusIdleView', async () => {
      await vscode.commands.executeCommand('workbench.view.explorer');
      await vscode.commands.executeCommand(`${VIEW_IDS.summary}.focus`);
    });

    context.subscriptions.push(focusCommand);
  } catch (error) {
    console.error('[vscode-idle] activate failed:', error);
    registerFailedProviders(vscode, context, VIEW_IDS);
  }
}

module.exports = {
  activate
};
