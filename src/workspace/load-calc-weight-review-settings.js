import { DEFAULT_WEIGHT_REVIEW_POLICY, WEIGHT_REVIEW_FAMILIES, readWeightReviewPolicy, saveWeightReviewPolicy } from './load-calc-weight-review-scope.js';

export function openWeightReviewSettings({ documentRef, onApplied = () => {} }) {
  documentRef.querySelector('[data-role="weight-review-settings"]')?.close();
  const previousFocus = documentRef.activeElement;
  const dialog = documentRef.createElement('dialog');
  dialog.dataset.role = 'weight-review-settings';
  dialog.setAttribute('aria-label', 'Weight review settings');
  dialog.style.cssText = 'width:min(650px,94vw);max-height:85vh;overflow:auto;background:#101c2e;color:#e2e8f0;border:1px solid #425771;border-radius:10px;padding:22px;font:14px system-ui';
  const render = policy => {
    dialog.innerHTML = `<h2>Weight review settings</h2><p>Choose which equipment appears in manual weight review.</p>
      <form><table style="width:100%;text-align:left"><thead><tr><th>Component</th><th>Manual review</th></tr></thead><tbody>
      ${WEIGHT_REVIEW_FAMILIES.map(([key, label]) => `<tr><td style="padding:8px">${label}</td><td><input type="checkbox" name="${key}" aria-label="Review ${label}" ${policy[key] ? 'checked' : ''}></td></tr>`).join('')}
      <tr><td style="padding:8px"><label for="weight-review-bore">Instrument bore above (mm)</label></td><td><input id="weight-review-bore" name="instrumentAboveMm" type="number" min="0" max="10000" step="any" required value="${policy.instrumentAboveMm}" style="width:95px"></td></tr></tbody></table>
      <p>Instruments at or below the configured bore threshold are outside manual review. Control/relief valves and UZV keep their valve rules. Unknown instrument bore stays visible for classification.</p>
      <details open><summary>Automatic weights</summary><table style="width:100%;text-align:left"><tbody>
      <tr><td>Elbow / tee / olet</td><td>Existing pipe-equivalent dry weight</td></tr><tr><td>Gasket</td><td>0 kg when no explicit weight is supplied</td></tr></tbody></table>
      <p>Standard fittings do not need catalogue-weight review. Their pipe-section basis and estimates remain visible. Explicit source/accepted weights take precedence.</p></details>
      <p style="color:#94a3b8">These settings only change the review list, not weights or calculation readiness. Saved in this browser.</p>
      <p data-settings-status role="status"></p><div style="display:flex;gap:10px"><button type="submit">Save review settings</button><button type="button" data-reset>Reset defaults</button><button type="button" data-close>Cancel</button></div></form>`;
  };
  render(readWeightReviewPolicy());
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) dialog.close();
    if (event.target.closest('[data-reset]')) render(DEFAULT_WEIGHT_REVIEW_POLICY);
  });
  dialog.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const form = dialog.querySelector('form');
      const policy = Object.fromEntries(WEIGHT_REVIEW_FAMILIES.map(([key]) => [key, form.elements.namedItem(key).checked]));
      const value = form.elements.namedItem('instrumentAboveMm').value;
      if (!value.trim()) throw new Error('Enter an instrument bore threshold.');
      policy.instrumentAboveMm = Number(value);
      saveWeightReviewPolicy(policy); dialog.close(); onApplied(policy);
    } catch (error) { dialog.querySelector('[data-settings-status]').textContent = error.message; }
  });
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); }, { once: true });
  documentRef.body.appendChild(dialog); dialog.showModal(); return dialog;
}
