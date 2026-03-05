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
const { loadState, saveState } = require('./storage');
const { getHtml } = require('./views');

function addBits(state, amount) {
  state.bits = clampBits(state.bits.add(amount));
}

function runTick(state, seconds, active) {
  try {
    applyDelta(state, seconds, active);
  } catch (error) {
    console.error('[vscode-idle] tick failed:', error);
    state.tickSpeed = 1;
    state.fever = 0;
  }
}

function getViewState(state) {
  try {
    return viewState(state);
  } catch (error) {
    console.error('[vscode-idle] viewState failed:', error);
    resetProgress(state);
    try {
      return viewState(state);
    } catch (retryError) {
      console.error('[vscode-idle] viewState recovery failed:', retryError);
      return null;
    }
  }
}

function setFallbackHtml(webview, mode) {
  webview.html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: sans-serif; padding: 12px;">
  <h3>Idle Game (${mode})</h3>
  <p>View initialization failed. Check "Log (Extension Host)".</p>
</body>
</html>`;
}

function activate(context) {
  try {
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
      const current = getViewState(state);
      if (!current) {
        return;
      }
      status.text = `$(flame) ${current.bitsText} bits  x${current.multiplierText}`;
    }

    function syncSummary() {
      if (!summaryView) {
        return;
      }
      const current = getViewState(state);
      if (current) {
        summaryView.webview.postMessage({ type: 'state', state: current });
      }
    }

    function syncDetail() {
      if (!detailView) {
        return;
      }
      const current = getViewState(state);
      if (current) {
        detailView.webview.postMessage({ type: 'state', state: current });
      }
    }

    function syncDebug() {
      if (!debugView) {
        return;
      }
      const current = getViewState(state);
      if (current) {
        debugView.webview.postMessage({ type: 'state', state: current });
      }
    }

    function syncReset() {
      if (!resetView) {
        return;
      }
      const current = getViewState(state);
      if (current) {
        resetView.webview.postMessage({ type: 'state', state: current });
      }
    }

    function syncAll() {
      syncSummary();
      syncDetail();
      syncReset();
      syncDebug();
    }

    function handleMessage(message) {
      if (message.type === 'buyLayer') {
        if (purchaseLayer(state, message.layerId)) {
          persist();
          updateStatus();
          syncAll();
        }
      }

      if (message.type === 'buyLayerMax') {
        if (purchaseMaxLayer(state, message.layerId)) {
          persist();
          updateStatus();
          syncAll();
        }
      }

      if (message.type === 'buyAllMax') {
        if (purchaseAllMax(state)) {
          persist();
          updateStatus();
          syncAll();
        }
      }

      if (message.type === 'sacrifice') {
        if (doSacrifice(state)) {
          persist();
          updateStatus();
          syncAll();
        }
      }

      if (message.type === 'prestige') {
        if (doPrestige(state)) {
          persist();
          updateStatus();
          syncAll();
        }
      }

      if (message.type === 'debugAddBits') {
        addBits(state, message.amount || '0');
        persist();
        updateStatus();
        syncAll();
      }

      if (message.type === 'setTickSpeed') {
        const speed = Number(message.speed || 1);
        state.tickSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
        persist();
        syncAll();
      }

      if (message.type === 'debugReset') {
        resetProgress(state);
        persist();
        updateStatus();
        syncAll();
      }

      if (message.type === 'toggleAutoBuy') {
        if (message.layerId && state.autoBuyEnabled) {
          state.autoBuyEnabled[message.layerId] = !!message.enabled;
        }
        persist();
        syncAll();
      }
    }

    const now = Date.now();
    const offlineSeconds = Math.max(0, (now - state.lastTick) / 1000);
    runTick(state, offlineSeconds, false);
    state.lastTick = now;

    updateStatus();

    const timer = setInterval(() => {
      const current = Date.now();
      const seconds = Math.max(0, (current - state.lastTick) / 1000);
      const active = current - state.lastInput <= ACTIVE_WINDOW_MS;

      runTick(state, seconds, active);

      state.lastTick = current;
      updateStatus();
      persist();
      syncAll();
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
        try {
          summaryView = webviewView;
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = getHtml(webviewView.webview, 'summary');
          webviewView.webview.onDidReceiveMessage(handleMessage);
          syncSummary();
        } catch (error) {
          console.error('[vscode-idle] summary view init failed:', error);
          setFallbackHtml(webviewView.webview, 'summary');
        }
      }
    };

    const detailProvider = {
      resolveWebviewView: (webviewView) => {
        try {
          detailView = webviewView;
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = getHtml(webviewView.webview, 'detail');
          webviewView.webview.onDidReceiveMessage(handleMessage);
          syncDetail();
        } catch (error) {
          console.error('[vscode-idle] detail view init failed:', error);
          setFallbackHtml(webviewView.webview, 'detail');
        }
      }
    };

    const resetProvider = {
      resolveWebviewView: (webviewView) => {
        try {
          resetView = webviewView;
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = getHtml(webviewView.webview, 'reset');
          webviewView.webview.onDidReceiveMessage(handleMessage);
          syncReset();
        } catch (error) {
          console.error('[vscode-idle] reset view init failed:', error);
          setFallbackHtml(webviewView.webview, 'reset');
        }
      }
    };

    const debugProvider = {
      resolveWebviewView: (webviewView) => {
        try {
          debugView = webviewView;
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = getHtml(webviewView.webview, 'debug');
          webviewView.webview.onDidReceiveMessage(handleMessage);
          syncDebug();
        } catch (error) {
          console.error('[vscode-idle] debug view init failed:', error);
          setFallbackHtml(webviewView.webview, 'debug');
        }
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
  } catch (error) {
    console.error('[vscode-idle] activate failed:', error);
    const failedProvider = {
      resolveWebviewView: (webviewView) => {
        setFallbackHtml(webviewView.webview, 'activate-failed');
      }
    };
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_IDS.summary, failedProvider));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_IDS.detail, failedProvider));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_IDS.reset, failedProvider));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_IDS.debug, failedProvider));
  }
}

module.exports = {
  activate
};
