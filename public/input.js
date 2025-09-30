/* input.js - backward-compatible version to avoid VS Code/ESLint red lines */
var API_BASE = window.location.origin + '/api';

var latestBlendId = null; // store latest blend ID
window.COAL_DB = window.COAL_DB || []; // will hold coal records once fetched

// small helpers to avoid optional chaining
function _getEl(id) {
  return document.getElementById(id) || null;
}
function _getElVal(id) {
  var el = _getEl(id);
  return el ? (el.value || '') : '';
}
function _parseFloatSafe(val) {
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/* collect current form state (same as before) */
function collectFormData() {
  var rows = [];
  for (var r = 1; r <= 3; r++) {
    var coalEl = _getEl('coalName' + r);
    var coalName = coalEl ? (coalEl.value || '') : '';
    coalName = coalName.trim();

    var percentages = [];
    for (var m = 0; m < 6; m++) {
      var selector = '.percentage-input[data-row="' + r + '"][data-mill="' + m + '"]';
      var p = document.querySelector(selector);
      var v = p ? (_parseFloatSafe(p.value) || 0) : 0;
      percentages.push(v);
    }

    var gcv = _parseFloatSafe(_getElVal('gcvBox' + r));
    var cost = _parseFloatSafe(_getElVal('costBox' + r));

    rows.push({ coal: coalName, percentages: percentages, gcv: gcv, cost: cost });
  }

  var flows = [];
  var flowEls = document.querySelectorAll('.flow-input');
  for (var i = 0; i < flowEls.length; i++) {
    flows.push(_parseFloatSafe(flowEls[i].value));
  }

  var generation = _parseFloatSafe(_getElVal('generation'));

  return { rows: rows, flows: flows, generation: generation, ts: Date.now() };
}

/* fetch latest blend ID */
async function fetchLatestBlendId() {
  try {
    var res = await fetch(API_BASE + '/blend/latest');
    if (!res.ok) return null;
    var data = await res.json();
    return data._id || null;
  } catch (err) {
    // older JS needs catch parameter
    return null;
  }
}

/* save or update blend */
async function saveToServer() {
  var payload = collectFormData();

  if (!latestBlendId) {
    latestBlendId = await fetchLatestBlendId();
  }

  var url = latestBlendId ? (API_BASE + '/blend/' + latestBlendId) : (API_BASE + '/blend');
  var method = latestBlendId ? 'PUT' : 'POST';

  try {
    var res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      var err;
      try { err = await res.json(); } catch (e) { err = { error: 'Unknown' }; }
      alert('Failed to save: ' + (err.error || res.status));
      return;
    }

    var data = await res.json();
    latestBlendId = data.id || latestBlendId;
    alert('Saved to database (id: ' + (latestBlendId || 'unknown') + ')');
  } catch (err) {
    console.error(err);
    alert('Network error saving data: ' + (err && err.message ? err.message : String(err)));
  }
}

/* hook save button */
document.addEventListener('DOMContentLoaded', function () {
  var btn = _getEl('saveBtn');
  if (btn) {
    btn.addEventListener('click', saveToServer);
  } else {
    console.warn('No #saveBtn found. Add <button id="saveBtn">Submit</button> to use database save.');
  }

  // load coals & populate dropdowns
  loadCoalListAndPopulate();
});

/* Try several endpoint paths (fallback) to fetch coal list */
async function tryFetchCoalEndpoints() {
  var endpoints = [
    API_BASE + '/coal',
    API_BASE + '/coals',
    API_BASE + '/coal/list',
    API_BASE + '/coalnames'
  ];

  for (var i = 0; i < endpoints.length; i++) {
    var ep = endpoints[i];
    try {
      var res = await fetch(ep);
      if (!res.ok) continue;
      var data = await res.json();

      // normalize response to an array of items
      var arr = [];
      if (Array.isArray(data)) arr = data;
      else if (Array.isArray(data.coals)) arr = data.coals;
      else if (Array.isArray(data.result)) arr = data.result;
      else if (Array.isArray(data.data)) arr = data.data;
      else if (typeof data === 'object' && Object.keys(data).length > 0) {
        var nested = data.docs || data.items || data.list || data.rows;
        if (Array.isArray(nested)) arr = nested;
        else arr = [data];
      }

      if (arr.length > 0) return arr;
    } catch (err) {
      // try next endpoint
      continue;
    }
  }
  return [];
}

/* loadCoalListAndPopulate - normalizes fields & populates selects */
async function loadCoalListAndPopulate() {
  var loader = _getEl('loader');
  if (loader) loader.style.display = 'block';

  var coals = await tryFetchCoalEndpoints();

  if (!coals || coals.length === 0) {
    if (loader) loader.style.display = 'none';
    console.warn('No coal list found from API endpoints. If your server has a different route, update input.js endpoints.');
    return;
  }

  // normalize fields & store
  window.COAL_DB = coals.map(function (c) {
    // safe id as string
    var safeId = String(c._id || c.id || c.coal || Math.random().toString(36).slice(2));
    // handle possible unicode property names using bracket notation
    var si = (c.SiO2 !== undefined) ? Number(c.SiO2) : ((c['SiO₂'] !== undefined) ? Number(c['SiO₂']) : 0);
    var al = (c.Al2O3 !== undefined) ? Number(c.Al2O3) : ((c['Al₂O₃'] !== undefined) ? Number(c['Al₂O₃']) : 0);
    return {
      _id: safeId,
      coal: c.coal || c.Coal || c.name || '',
      SiO2: si,
      Al2O3: al,
      Fe2O3: Number(c.Fe2O3 || c['Fe₂O₃'] || 0),
      CaO: Number(c.CaO || 0),
      MgO: Number(c.MgO || 0),
      Na2O: Number(c.Na2O || 0),
      K2O: Number(c.K2O || 0),
      TiO2: Number(c.TiO2 || 0),
      SO3: Number(c.SO3 || 0),
      gcv: Number(c.gcv || c.GCV || 0),
      cost: Number(c.cost || c.Cost || 0),
      raw: c
    };
  });

  // fill the 3 selects
  for (var r = 1; r <= 3; r++) {
    var sel = _getEl('coalName' + r);
    if (!sel) continue;
    // clear existing options except first
    sel.innerHTML = '<option value="">Select coal</option>';
    for (var j = 0; j < window.COAL_DB.length; j++) {
      var c = window.COAL_DB[j];
      var opt = document.createElement('option');
      opt.value = c._id;
      opt.textContent = c.coal || ('Coal ' + c._id);
      sel.appendChild(opt);
    }

    // when user changes selection, populate gcv & cost and recalc
    (function (rowIndex, selElem) {
      selElem.addEventListener('change', function (e) {
        var chosenId = e.target.value;
        var coalObj = null;
        for (var k = 0; k < window.COAL_DB.length; k++) {
          if (String(window.COAL_DB[k]._id) === String(chosenId)) {
            coalObj = window.COAL_DB[k];
            break;
          }
        }
        if (coalObj) {
          var gcvEl = _getEl('gcvBox' + rowIndex);
          var costEl = _getEl('costBox' + rowIndex);

          if (gcvEl && (gcvEl.value === "" || gcvEl.value === undefined)) {
            gcvEl.value = (coalObj.gcv !== undefined) ? coalObj.gcv : '';
          } else {
            if (gcvEl && (gcvEl.value === "")) gcvEl.value = coalObj.gcv;
          }
          if (costEl && (costEl.value === "" || costEl.value === undefined)) {
            costEl.value = (coalObj.cost !== undefined) ? coalObj.cost : '';
          } else {
            if (costEl && (costEl.value === "")) costEl.value = coalObj.cost;
          }
        }
        try { if (window.calculateBlended) window.calculateBlended(); } catch (e) { /* ignore */ }
      });
    })(r, sel);
  }

  if (loader) loader.style.display = 'none';
  try {
    if (window.calculateBlended) window.calculateBlended();
    if (window.validateMillPercentages) window.validateMillPercentages();
    if (window.updateBunkerColors) window.updateBunkerColors();
  } catch (e) { console.warn(e); }
}

/* optional helper: get coal by id or name */
function getCoalByIdOrName(value) {
  if (!value) return null;
  var db = window.COAL_DB || [];
  for (var i = 0; i < db.length; i++) {
    if (String(db[i]._id) === String(value)) return db[i];
  }
  for (var j = 0; j < db.length; j++) {
    if (String((db[j].coal || '').toLowerCase()) === String(value).toLowerCase()) return db[j];
  }
  return null;
}

// export/save functions used elsewhere if needed
window.getCoalByIdOrName = getCoalByIdOrName;
