const vscode = require('vscode');
const {
  TICK_MS,
  ACTIVE_WINDOW_MS,
  VIEW_IDS
} = require('./constants');
const { createGameState, serializeGameState, resetProgress } = require('./domain/state');
const { applyDelta } = require('./domain/progression');
const { viewState } = require('./ui/viewState');
const { purchaseLayer, purchaseMaxLayer, purchaseAllMax } = require('./domain/purchases');
const { doSacrifice, doPrestige } = require('./domain/resets');
const { clampBits } = require('./lib/utils');

function addBits(state, amount) {
  state.bits = clampBits(state.bits.add(amount));
}
const { loadState, saveState } = require('./storage');
const { getHtml } = require('./views');

function activate(context) {
  const state = createGameState(loadState(context));

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = 'vscode-idle.focusIdleView';
  status.tooltip = 'Open Idle Game';
  status.show();
  context.subscriptions.push(status);

  let summaryView = null;
  let detailView = null;
  let resetView = null;
  let debugView = null;

  function persist() {
    saveState(context, serializeGameState(state));
  }

  function updateStatus() {
    const current = viewState(state);
    status.text = `$(flame) ${current.bitsText} bits  x${current.multiplierText}`;
  }

  function syncSummary() {
    if (summaryView) {
      summaryView.webview.postMessage({ type: 'state', state: viewState(state) });
    }
  }

  function syncDetail() {
    if (detailView) {
      detailView.webview.postMessage({ type: 'state', state: viewState(state) });
    }
  }

  function syncDebug() {
    if (debugView) {
      debugView.webview.postMessage({ type: 'state', state: viewState(state) });
    }
  }

  function syncReset() {
    if (resetView) {
      resetView.webview.postMessage({ type: 'state', state: viewState(state) });
    }
  }

  function handleMessage(message) {
    if (message.type === 'buyLayer') {
      if (purchaseLayer(state, message.layerId)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncReset();
        syncDebug();
      }
    }
    if (message.type === 'buyLayerMax') {
      if (purchaseMaxLayer(state, message.layerId)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncReset();
        syncDebug();
      }
    }
    if (message.type === 'buyAllMax') {
      if (purchaseAllMax(state)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncReset();
        syncDebug();
      }
    }
    if (message.type === 'sacrifice') {
      if (doSacrifice(state)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncDebug();
      }
    }
    if (message.type === 'prestige') {
      if (doPrestige(state)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncDebug();
      }
    }
    if (message.type === 'debugAddBits') {
      addBits(state, message.amount || '0');
      persist();
      updateStatus();
      syncSummary();
      syncDetail();
      syncReset();
      syncDebug();
    }
    if (message.type === 'setTickSpeed') {
      const speed = Number(message.speed || 1);
      state.tickSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
      persist();
      syncSummary();
      syncDetail();
      syncReset();
      syncDebug();
    }
    if (message.type === 'debugReset') {
      resetProgress(state);
      persist();
      updateStatus();
      syncSummary();
      syncDetail();
      syncReset();
      syncDebug();
    }
    if (message.type === 'toggleAutoBuy') {
      if (message.layerId && state.autoBuyEnabled) {
        state.autoBuyEnabled[message.layerId] = !!message.enabled;
      }
      persist();
      syncSummary();
      syncDetail();
      syncReset();
      syncDebug();
    }
    if (message.type === 'sacrifice') {
      if (doSacrifice(state)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncReset();
        syncDebug();
      }
    }
    if (message.type === 'prestige') {
      if (doPrestige(state)) {
        persist();
        updateStatus();
        syncSummary();
        syncDetail();
        syncReset();
        syncDebug();
      }
    }
  }

  const now = Date.now();
  const offlineSeconds = Math.max(0, (now - state.lastTick) / 1000);
  applyDelta(state, offlineSeconds, false);
  state.lastTick = now;

  updateStatus();

  const timer = setInterval(() => {
    const current = Date.now();
    const seconds = Math.max(0, (current - state.lastTick) / 1000);
    const active = current - state.lastInput <= ACTIVE_WINDOW_MS;

    applyDelta(state, seconds, active);

    state.lastTick = current;
    updateStatus();
    persist();
    syncSummary();
    syncDetail();
    syncReset();
    syncDebug();
  }, TICK_MS);

  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  const inputListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.contentChanges && event.contentChanges.length > 0) {
      state.lastInput = Date.now();
    }
  });
  context.subscriptions.push(inputListener);

  const summaryProvider = {
    resolveWebviewView: (webviewView) => {
      summaryView = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getHtml(webviewView.webview, 'summary');
      webviewView.webview.onDidReceiveMessage(handleMessage);
      syncSummary();
    }
  };

  const detailProvider = {
    resolveWebviewView: (webviewView) => {
      detailView = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getHtml(webviewView.webview, 'detail');
      webviewView.webview.onDidReceiveMessage(handleMessage);
      syncDetail();
    }
  };

  const resetProvider = {
    resolveWebviewView: (webviewView) => {
      resetView = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getHtml(webviewView.webview, 'reset');
      webviewView.webview.onDidReceiveMessage(handleMessage);
      syncReset();
    }
  };

  const debugProvider = {
    resolveWebviewView: (webviewView) => {
      debugView = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getHtml(webviewView.webview, 'debug');
      webviewView.webview.onDidReceiveMessage(handleMessage);
      syncDebug();
    }
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_IDS.summary, summaryProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_IDS.detail, detailProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_IDS.reset, resetProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_IDS.debug, debugProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  const focusCommand = vscode.commands.registerCommand('vscode-idle.focusIdleView', async () => {
    await vscode.commands.executeCommand('workbench.view.explorer');
    await vscode.commands.executeCommand(`${VIEW_IDS.summary}.focus`);
  });

  context.subscriptions.push(focusCommand);
}

module.exports = {
  activate
};
