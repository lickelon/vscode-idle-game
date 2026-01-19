function getHtml(webview, mode) {
  const nonce = getNonce();
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  const isDetail = mode === 'detail';
  const isDebug = mode === 'debug';
  const debugSection = isDebug ? [
    '<div class="card">',
    '  <strong>Debug</strong>',
    '  <div class="row">',
    '    <button data-debug="add-1e3">+1e3 bits</button>',
    '    <button data-debug="add-1e6">+1e6 bits</button>',
    '    <button data-debug="add-1e9">+1e9 bits</button>',
    '    <button data-debug="add-1e12">+1e12 bits</button>',
    '    <button data-debug="reset">Reset</button>',
    '  </div>',
    '</div>'
  ].join('\n') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idle Core</title>
  <style>
    :root {
      --bg: #0f141b;
      --panel: #151b24;
      --accent: #ffb347;
      --accent-2: #4cc9f0;
      --text: #e6edf3;
      --muted: #9aa4b2;
      --outline: rgba(255, 255, 255, 0.08);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
      background: radial-gradient(circle at top left, #1b2331, var(--bg));
      color: var(--text);
    }
    .wrap {
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    header {
      padding: 12px 14px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(255, 179, 71, 0.18), rgba(76, 201, 240, 0.08));
      border: 1px solid var(--outline);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 18px;
      letter-spacing: 0.4px;
    }
    .stat {
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    .stat strong {
      color: var(--text);
      font-size: 16px;
    }
    .card {
      background: var(--panel);
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--outline);
      display: grid;
      gap: 6px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    button {
      border: none;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: #10151f;
      background: linear-gradient(135deg, var(--accent), #ffcc66);
    }
    .tag {
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      font-size: 11px;
      color: var(--muted);
    }
    .layers {
      display: grid;
      gap: 10px;
    }
    .layer {
      border: 1px solid var(--outline);
      border-radius: 12px;
      padding: 10px 12px;
      display: grid;
      gap: 6px;
      background: rgba(10, 14, 20, 0.4);
    }
    .layer-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }
    .layer-meta {
      font-size: 12px;
      color: var(--muted);
      display: grid;
      gap: 4px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${isDebug ? '' : `
    <header>
      <h1>${isDetail ? 'Idle Core - Control Room' : 'Idle Core'}</h1>
      <div class="stat">
        <span>Bits</span>
        <strong id="bits">0</strong>
        <span>Base: <span id="baseBits">0</span> / sec</span>
        <span>Final: <span id="finalBits">0</span> / sec</span>
        <span>Fever: <span id="fever">0</span> | Multiplier: <span id="multiplier">1.00</span>x</span>
      </div>
    </header>
    `}

    ${isDebug ? '' : `
    <div class="card">
      <strong>Layers</strong>
      <div class="layers" id="layers"></div>
    </div>

    <div class="card">
      <strong>Rules</strong>
      <span class="muted">Delivered comes from higher layers. Typing exponent scales with Runtime/Cloud.</span>
    </div>
    `}

    ${debugSection}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const isDetail = ${isDetail ? 'true' : 'false'};
    const isDebug = ${isDebug ? 'true' : 'false'};

    const bits = document.getElementById('bits');
    const baseBits = document.getElementById('baseBits');
    const finalBits = document.getElementById('finalBits');
    const fever = document.getElementById('fever');
    const multiplier = document.getElementById('multiplier');
    const layers = document.getElementById('layers');

    function renderLayer(layer) {
      return [
        '<div class=\"layer\">',
        '  <div class=\"layer-title\">',
        '    <span>' + layer.name + '</span>',
        '    <span class=\"tag\">Tier ' + layer.tier + '</span>',
        '  </div>',
        '  <div class=\"layer-meta\">',
        '    <span>Level: ' + layer.levelText + ' | Delivered: ' + layer.deliveredText + '</span>',
        '    <span>C: ' + layer.cText + ' → E: ' + layer.eText + '</span>',
        '    <span>Cost: ' + layer.costText + ' bits</span>',
        '  </div>',
        '  <div class=\"row\">',
        isDetail ? '    <button data-layer=\"' + layer.id + '\">Upgrade</button>' : '',
        isDetail ? '    <button data-layer=\"' + layer.id + '\" data-action=\"max\">Max</button>' : '',
        '  </div>',
        '</div>'
      ].join('\\n');
    }

    function render(state) {
      bits.textContent = state.bitsText;
      baseBits.textContent = state.baseBitsText;
      finalBits.textContent = state.finalBitsText;
      fever.textContent = state.feverText;
      multiplier.textContent = state.multiplierText;
      const visibleLayers = isDebug ? [] : (isDetail ? state.layers : state.layers.slice(0, 2));
      layers.innerHTML = visibleLayers.map(renderLayer).join('');
    }

    layers.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-layer]');
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      if (action === 'max') {
        vscode.postMessage({ type: 'buyLayerMax', layerId: button.dataset.layer });
      } else {
        vscode.postMessage({ type: 'buyLayer', layerId: button.dataset.layer });
      }
    });

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-debug]');
      if (!button) {
        return;
      }
      const action = button.dataset.debug;
      if (action === 'reset') {
        vscode.postMessage({ type: 'debugReset' });
        return;
      }
      const amount = action.replace('add-', '');
      vscode.postMessage({ type: 'debugAddBits', amount });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'state') {
        render(message.state);
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

module.exports = {
  getHtml
};
