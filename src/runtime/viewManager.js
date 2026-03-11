const MODES = ['summary', 'detail', 'reset', 'debug'];

function setFallbackHtml(webview, mode) {
  webview.html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: sans-serif; padding: 12px;">
  <h3>Idle Game (${mode})</h3>
  <p>View initialization failed. Check "Log (Extension Host)".</p>
</body>
</html>`;
}

function createViewManager({ getHtml, onMessage, getState }) {
  const views = {
    summary: null,
    detail: null,
    reset: null,
    debug: null
  };

  function sync(mode) {
    const view = views[mode];
    if (!view) {
      return;
    }
    const current = getState();
    if (current) {
      view.webview.postMessage({ type: 'state', state: current });
    }
  }

  function syncAll() {
    for (const mode of MODES) {
      sync(mode);
    }
  }

  function createProvider(mode) {
    return {
      resolveWebviewView: (webviewView) => {
        try {
          views[mode] = webviewView;
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = getHtml(webviewView.webview, mode);
          webviewView.webview.onDidReceiveMessage(onMessage);
          sync(mode);
        } catch (error) {
          console.error(`[vscode-idle] ${mode} view init failed:`, error);
          setFallbackHtml(webviewView.webview, mode);
        }
      }
    };
  }

  function register(vscode, context, viewIds) {
    for (const mode of MODES) {
      context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(viewIds[mode], createProvider(mode), {
          webviewOptions: { retainContextWhenHidden: true }
        })
      );
    }
  }

  return {
    register,
    sync,
    syncAll
  };
}

function registerFailedProviders(vscode, context, viewIds) {
  const failedProvider = {
    resolveWebviewView: (webviewView) => {
      setFallbackHtml(webviewView.webview, 'activate-failed');
    }
  };

  for (const mode of MODES) {
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(viewIds[mode], failedProvider));
  }
}

module.exports = {
  createViewManager,
  registerFailedProviders
};
