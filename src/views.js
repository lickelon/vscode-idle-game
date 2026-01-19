function getHtml(webview, mode) {
  const nonce = getNonce();
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  const isDetail = mode === 'detail';
  const isReset = mode === 'reset';
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

  const resetSection = isReset ? [
    '<div class="card">',
    '  <strong>Resets</strong>',
    '  <div class="layers">',
    '    <div class="layer">',
    '      <div class="layer-title">',
    '        <span>Sacrifice</span>',
    '        <span class="tag">Reset</span>',
    '      </div>',
    '      <div class="layer-meta">',
    '        <span>Current mult: <span id="sacrificeMult">1</span>x</span>',
    '        <span>After sacrifice: <span id="sacrificeReward">1</span>x</span>',
    '      </div>',
    '      <div class="row">',
    '        <button data-reset="sacrifice" id="sacrificeBtn">Sacrifice</button>',
    '      </div>',
    '    </div>',
    '    <div class="layer">',
    '      <div class="layer-title">',
    '        <span>Prestige</span>',
    '        <span class="tag">Reset</span>',
    '      </div>',
    '      <div class="layer-meta">',
    '        <span>Current base: <span id="prestigeBase">0</span></span>',
    '        <span>On prestige: +<span id="prestigeGain">0</span> base</span>',
    '      </div>',
    '      <div class="row">',
    '        <button data-reset="prestige" id="prestigeBtn">Prestige</button>',
    '      </div>',
    '    </div>',
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
      padding: 10px 0;
      display: grid;
      gap: 12px;
    }
    header {
      padding: 12px 6px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(255, 179, 71, 0.18), rgba(76, 201, 240, 0.08));
      border: 1px solid var(--outline);
    }
    .floating-summary {
      position: sticky;
      top: 6px;
      z-index: 10;
      display: none;
      padding: 6px 10px;
      border-radius: 12px;
      background: rgba(15, 20, 27, 0.9);
      border: 1px solid var(--outline);
      font-size: 12px;
      color: var(--muted);
    }
    .floating-summary strong {
      color: var(--text);
      font-size: 13px;
    }
    .floating-summary .row {
      gap: 12px;
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
      padding: 10px 6px;
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
      padding: 8px 6px;
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
    ${isDebug || isReset ? '' : `
    <div class="floating-summary" id="floatingSummary">
      <div class="row">
        <span><strong id="bitsMini">0</strong> bits</span>
        <span>Final <span id="finalBitsMini">0</span>/s</span>
        <span>x<span id="multiplierMini">1.00</span></span>
      </div>
    </div>
    <header>
      <h1>${isDetail ? 'Idle Core - Control Room' : 'Idle Core'}</h1>
      <div class="stat">
        <span>Bits</span>
        <strong id="bits">0</strong>
        <span>Base: <span id="baseBits">0</span> / sec</span>
        <span>Final: <span id="finalBits">0</span> / sec</span>
        <span>Fever: <span id="fever">0</span> | Multiplier: <span id="multiplier">1.00</span>x</span>
        <span>Sacrifice Mult: <span id="sacrificeMult">1</span>x</span>
      </div>
    </header>
    `}

    ${isDebug || isReset ? '' : `
    <div class="card">
      <div class="row" style="justify-content: space-between;">
        <strong>Layers</strong>
        ${isDetail ? '<button data-action="max-all">Max All</button>' : ''}
      </div>
      <div class="layers" id="layers"></div>
    </div>
    `}

    ${resetSection}

    ${debugSection}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const isDetail = ${isDetail ? 'true' : 'false'};
    const isReset = ${isReset ? 'true' : 'false'};
    const isDebug = ${isDebug ? 'true' : 'false'};

    const bits = document.getElementById('bits');
    const baseBits = document.getElementById('baseBits');
    const finalBits = document.getElementById('finalBits');
    const fever = document.getElementById('fever');
    const multiplier = document.getElementById('multiplier');
    const floatingSummary = document.getElementById('floatingSummary');
    const bitsMini = document.getElementById('bitsMini');
    const finalBitsMini = document.getElementById('finalBitsMini');
    const multiplierMini = document.getElementById('multiplierMini');
    const summaryHeader = document.querySelector('header');
    const sacrificeMult = document.getElementById('sacrificeMult');
    const sacrificeReward = document.getElementById('sacrificeReward');
    const prestigeBase = document.getElementById('prestigeBase');
    const prestigeGain = document.getElementById('prestigeGain');
    const sacrificeBtn = document.getElementById('sacrificeBtn');
    const prestigeBtn = document.getElementById('prestigeBtn');
    const layers = document.getElementById('layers');

    function renderLayer(layer) {
      return [
        '<div class=\"layer\">',
        '  <div class=\"layer-title\">',
        '    <span>' + layer.name + '</span>',
        '    <span class=\"tag\">Tier <span data-layer=\"' + layer.id + '\" data-field=\"tier\">' + layer.tier + '</span></span>',
        '  </div>',
        '  <div class=\"layer-meta\">',
        '    <span>Level: <span data-layer=\"' + layer.id + '\" data-field=\"level\">' + layer.levelText + '</span> | Delivered: <span data-layer=\"' + layer.id + '\" data-field=\"delivered\">' + layer.deliveredText + '</span></span>',
        '    <span>Next tier in: <span data-layer=\"' + layer.id + '\" data-field=\"nextTier\">' + layer.nextTierText + '</span></span>',
        '    <span>C: <span data-layer=\"' + layer.id + '\" data-field=\"c\">' + layer.cText + '</span> → E: <span data-layer=\"' + layer.id + '\" data-field=\"e\">' + layer.eText + '</span></span>',
        '    <span>Cost: <span data-layer=\"' + layer.id + '\" data-field=\"cost\">' + layer.costText + '</span> bits</span>',
        '  </div>',
        '  <div class=\"row\">',
        isDetail ? '    <button data-layer=\"' + layer.id + '\">Upgrade</button>' : '',
        isDetail ? '    <button data-layer=\"' + layer.id + '\" data-action=\"max\">Max</button>' : '',
        '  </div>',
        '</div>'
      ].join('\\n');
    }

    let pendingState = null;
    let renderScheduled = false;
    let lastRenderAt = 0;
    const renderInterval = 200;

    function getVisibleLayers(state) {
      if (isDebug || isReset) {
        return [];
      }
      return isDetail ? state.layers : state.layers.slice(0, 2);
    }

    function updateLayerField(layerId, field, value) {
      const node = layers.querySelector('[data-layer=\"' + layerId + '\"][data-field=\"' + field + '\"]');
      if (node) {
        node.textContent = value;
      }
    }

    function buildLayers(state) {
      const visibleLayers = getVisibleLayers(state);
      layers.innerHTML = visibleLayers.map(renderLayer).join('');
    }

    function updateLayers(state) {
      const visibleLayers = getVisibleLayers(state);
      visibleLayers.forEach((layer) => {
        updateLayerField(layer.id, 'tier', layer.tier);
        updateLayerField(layer.id, 'level', layer.levelText);
        updateLayerField(layer.id, 'delivered', layer.deliveredText);
        updateLayerField(layer.id, 'nextTier', layer.nextTierText);
        updateLayerField(layer.id, 'c', layer.cText);
        updateLayerField(layer.id, 'e', layer.eText);
        updateLayerField(layer.id, 'cost', layer.costText);
      });
    }

    let layersBuilt = false;

    function render(state) {
      if (bits) {
        bits.textContent = state.bitsText;
      }
      if (baseBits) {
        baseBits.textContent = state.baseBitsText;
      }
      if (finalBits) {
        finalBits.textContent = state.finalBitsText;
      }
      if (fever) {
        fever.textContent = state.feverText;
      }
      if (multiplier) {
        multiplier.textContent = state.multiplierText;
      }
      if (bitsMini) {
        bitsMini.textContent = state.bitsText;
      }
      if (finalBitsMini) {
        finalBitsMini.textContent = state.finalBitsText;
      }
      if (multiplierMini) {
        multiplierMini.textContent = state.multiplierText;
      }
      if (sacrificeMult) {
        sacrificeMult.textContent = state.sacrificeMultText;
      }
      if (sacrificeReward) {
        sacrificeReward.textContent = state.sacrificeNextRewardText || state.sacrificeRewardText;
      }
      if (prestigeBase) {
        prestigeBase.textContent = state.totalBaseText;
      }
      if (prestigeGain) {
        prestigeGain.textContent = state.prestigeGainText;
      }
      if (sacrificeBtn) {
        sacrificeBtn.disabled = !state.canSacrifice;
      }
      if (prestigeBtn) {
        prestigeBtn.disabled = !state.canPrestige;
      }
      if (layers) {
        if (!layersBuilt) {
          buildLayers(state);
          layersBuilt = true;
        } else {
          updateLayers(state);
        }
      }
    }

    if (layers) {
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
    }

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action="max-all"]');
      if (!button) {
        return;
      }
      vscode.postMessage({ type: 'buyAllMax' });
    });

    if (floatingSummary && summaryHeader) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          floatingSummary.style.display = entry.isIntersecting ? 'none' : 'block';
        },
        { root: null, threshold: 0.1 }
      );
      observer.observe(summaryHeader);
    }

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

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-reset]');
      if (!button) {
        return;
      }
      const action = button.dataset.reset;
      vscode.postMessage({ type: action });
    });

    function scheduleRender(state) {
      pendingState = state;
      if (renderScheduled) {
        return;
      }
      renderScheduled = true;
      const run = () => {
        const now = Date.now();
        const wait = renderInterval - (now - lastRenderAt);
        if (wait > 0) {
          setTimeout(run, wait);
          return;
        }
        renderScheduled = false;
        lastRenderAt = Date.now();
        if (pendingState) {
          render(pendingState);
        }
      };
      requestAnimationFrame(run);
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'state') {
        scheduleRender(message.state);
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
