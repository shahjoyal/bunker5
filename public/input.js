const API_BASE = 'http://localhost:5000/api';

let latestBlendId = null; // store latest blend ID

// collect current form state (same as before)
function collectFormData() {
  const rows = [];
  for (let r = 1; r <= 3; r++) {
    const coalName = (document.getElementById(`coalName${r}`)?.value || '').trim();
    const percentages = [];
    for (let m = 0; m < 6; m++) {
      const p = document.querySelector(`.percentage-input[data-row="${r}"][data-mill="${m}"]`);
      const v = p ? (parseFloat(p.value) || 0) : 0;
      percentages.push(v);
    }
    const gcv = parseFloat(document.getElementById(`gcvBox${r}`)?.value) || 0;
    const cost = parseFloat(document.getElementById(`costBox${r}`)?.value) || 0;
    rows.push({ coal: coalName, percentages, gcv, cost });
  }

  const flows = [];
  document.querySelectorAll('.flow-input').forEach(el => {
    flows.push(parseFloat(el.value) || 0);
  });

  const generation = parseFloat(document.getElementById('generation')?.value) || 0;

  return { rows, flows, generation, ts: Date.now() };
}

// fetch latest blend ID
async function fetchLatestBlendId() {
  try {
    const res = await fetch(`${API_BASE}/blend/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data._id || null;
  } catch {
    return null;
  }
}

// save or update blend
async function saveToServer() {
  const payload = collectFormData();

  if (!latestBlendId) {
    latestBlendId = await fetchLatestBlendId();
  }

  const url = latestBlendId ? `${API_BASE}/blend/${latestBlendId}` : `${API_BASE}/blend`;
  const method = latestBlendId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown' }));
      alert('Failed to save: ' + (err.error || res.status));
      return;
    }

    const data = await res.json();
    latestBlendId = data.id || latestBlendId;
    alert('Saved to database (id: ' + (latestBlendId || 'unknown') + ')');
  } catch (err) {
    console.error(err);
    alert('Network error saving data: ' + err.message);
  }
}

// hook save button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('saveBtn');
  if (btn) {
    btn.addEventListener('click', saveToServer);
  } else {
    console.warn('No #saveBtn found. Add <button id="saveBtn">Submit</button> to use database save.');
  }
});
