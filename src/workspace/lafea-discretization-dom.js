/**
 * Shared stateless presentation helpers for the Discretization surface.
 *
 * This module is an explicit leaf in the production bundle. It may project
 * already-retained mesh-quality evidence and create DOM nodes, but it must not
 * own a controller, store, mutable singleton, engineering threshold, mesh
 * generator, or quality classification authority.
 */
import { createLafeaInfoDisclosure } from './lafea-info-disclosure.js';

const SEVERITY = Object.freeze({ OK: 0, WARNING: 1, BLOCK: 2 });
const MAX_INLINE_FOCUS_ACTIONS = 6;

const METRIC_LABELS = Object.freeze({
  ASPECT_RATIO: 'Aspect ratio',
  MINIMUM_ANGLE_DEGREES: 'Minimum interior angle',
  SCALED_JACOBIAN: 'Minimum scaled Jacobian',
  ADJACENT_SIZE_RATIO: 'Maximum adjacent element-size ratio',
  SHELL_WARPAGE_DEGREES: 'Shell warpage',
  BOUNDARY_SEGMENT_COUNT: 'Boundary segment count',
  SHELL_SIZE_TO_THICKNESS_RATIO: 'Element size / thickness',
  SHELL_ORIENTATION_TOPOLOGY: 'Shell orientation / topology',
});

const METRIC_UNITS = Object.freeze({
  ASPECT_RATIO: 'ratio',
  MINIMUM_ANGLE_DEGREES: 'deg',
  SCALED_JACOBIAN: 'ratio',
  ADJACENT_SIZE_RATIO: 'ratio',
  SHELL_WARPAGE_DEGREES: 'deg',
  BOUNDARY_SEGMENT_COUNT: 'count',
  SHELL_SIZE_TO_THICKNESS_RATIO: 'ratio',
  SHELL_ORIENTATION_TOPOLOGY: 'pass=1',
});

export function region(doc, title, role) {
  const section = node(doc, 'section', 'lafea-discretization__section');
  section.dataset.discretizationSection = role;
  section.append(node(doc, 'h3', null, title));
  return section;
}

export function button(doc, text, handler) {
  const value = node(doc, 'button', null, text);
  value.type = 'button';
  value.addEventListener('click', handler);
  return value;
}

export function node(doc, tag, className = null, text = undefined) {
  const value = doc.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

/**
 * Build a display model from retained gate evidence.
 *
 * Gate classification remains owned by the meshing quality-gate package.
 * `context.quality`, when supplied, is used only to associate a non-OK
 * aggregate gate with affected retained element IDs. This function never
 * recomputes or reclassifies an engineering metric.
 *
 * No numerical quality status is asserted here: the panel presents the retained
 * gate outcome and never renders a computed metric verdict of its own.
 */
export function buildMeshQualityPanel(gateResults, context) {
  if (!Array.isArray(gateResults)) {
    throw new TypeError('buildMeshQualityPanel requires an array of gate results.');
  }
  requireText(context?.stageId, 'stageId');
  requireText(context?.meshProfileIdentity, 'meshProfileIdentity');
  const rows = gateResults.map((result, index) => toQualityRow(result, index, context?.quality ?? null));
  const worst = rows.reduce(
    (current, row) => (SEVERITY[row.status] > SEVERITY[current] ? row.status : current),
    'OK',
  );
  return Object.freeze({
    stageId: context.stageId,
    meshProfileIdentity: context.meshProfileIdentity,
    rows: Object.freeze(rows),
    worstStatus: worst,
    blocksAdvance: worst === 'BLOCK',
    counts: Object.freeze({
      ok: rows.filter((row) => row.status === 'OK').length,
      warning: rows.filter((row) => row.status === 'WARNING').length,
      block: rows.filter((row) => row.status === 'BLOCK').length,
    }),
  });
}

function toQualityRow(result, index, quality) {
  const path = `meshQuality.gateResults[${index}]`;
  const metric = result?.metric;
  if (typeof metric !== 'string' || !metric) {
    throw new TypeError(`${path}.metric is required.`);
  }
  if (!Object.hasOwn(METRIC_LABELS, metric)) {
    throw new TypeError(`${path}.metric is not a known mesh-quality metric: ${metric}`);
  }
  if (typeof result.value !== 'number' || !Number.isFinite(result.value)) {
    throw new TypeError(`${path}.value must be a finite number.`);
  }
  if (!Object.hasOwn(SEVERITY, result.status)) {
    throw new TypeError(`${path}.status must be OK, WARNING or BLOCK.`);
  }
  return Object.freeze({
    metric,
    label: METRIC_LABELS[metric],
    value: result.value,
    unit: METRIC_UNITS[metric],
    status: result.status,
    threshold: thresholdOf(result, metric),
    sourcePath: `${path}.value`,
    affectedElementIds: Object.freeze(affectedElementIds(result, quality)),
  });
}

function affectedElementIds(result, quality) {
  if (result.status === 'OK' || !quality || typeof quality !== 'object') return [];
  if (['ASPECT_RATIO', 'MINIMUM_ANGLE_DEGREES', 'SCALED_JACOBIAN'].includes(result.metric)) {
    return uniqueSorted((quality.elementResults ?? [])
      .filter((element) => element.metrics?.some((metric) => (
        metric.metric === result.metric && metric.status === result.status
      )))
      .map((element) => element.elementId));
  }
  if (result.metric === 'ADJACENT_SIZE_RATIO') {
    return uniqueSorted((quality.adjacentSizeRatio?.violatingAdjacencies ?? [])
      .flatMap((row) => row.elementIds ?? []));
  }
  if (result.metric === 'SHELL_ORIENTATION_TOPOLOGY') {
    return shellTopologyElementIds(quality);
  }
  return [];
}

function shellTopologyElementIds(quality) {
  const shell = quality.shellOrientationTopology;
  if (!shell || shell.qualification === 'PASS') return [];
  if (shell.state === 'DISCONNECTED_PATCHES') {
    return uniqueSorted((quality.elementResults ?? []).map((element) => element.elementId));
  }
  return uniqueSorted([
    ...(shell.elementsRequiringFlip ?? []),
    ...(shell.nonManifoldEdges ?? []).flatMap((edge) => edge.elementIds ?? []),
  ]);
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value))].sort();
}

function thresholdOf(result, metric) {
  const declared = [
    'minimum', 'maximum', 'minimumMultiple', 'maximumMultiple',
    'warningThreshold', 'blockingThreshold',
  ]
    .filter((key) => typeof result[key] === 'number')
    .map((key) => `${thresholdLabel(key)} ${formatQualityNumber(metric, result[key])}`);
  return declared.length ? declared.join(' · ') : null;
}

function thresholdLabel(key) {
  return Object.freeze({
    minimum: 'min',
    maximum: 'max',
    minimumMultiple: 'min multiple',
    maximumMultiple: 'max multiple',
    warningThreshold: 'warning',
    blockingThreshold: 'block',
  })[key] ?? key;
}

/** The single place callers ask whether retained mesh evidence blocks advance. */
export function panelBlocksAdvance(panel) {
  return panel.blocksAdvance === true;
}

function requireText(value, key) {
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`buildMeshQualityPanel requires a ${key}.`);
  }
}

/** Render retained mesh-quality evidence with presentation-only rounding. */
export function renderMeshQualityPanel(rootElement, panel, options = {}) {
  if (!rootElement) return;
  rootElement.replaceChildren();
  const documentRef = rootElement.ownerDocument;
  const container = documentRef.createElement('div');
  container.className = 'lafea-mesh-quality-panel';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'LAFEA retained mesh quality evidence');

  const stageId = options.stageId || panel?.stageId || 'UNKNOWN';
  const title = documentRef.createElement('h4');
  title.textContent = `Mesh quality — ${stageId}`;
  container.append(title);

  const meshConfig = options.documentValue?.meshConfig;
  if (meshConfig && typeof meshConfig === 'object') {
    container.append(createLafeaInfoDisclosure(documentRef, 'Unapplied workbench mesh preference', [
      ['Preference', summarizeConfig(meshConfig)],
      ['Engineering effect', 'NONE — not connected to a qualified stage mesh compiler'],
    ], { summaryText: 'Mesh preference (i)' }));
  }

  if (!panel) {
    const neutral = documentRef.createElement('p');
    neutral.className = 'lafea-mesh-quality-panel__neutral';
    neutral.textContent = 'No retained mesh-quality result is available.';
    container.append(neutral);
    rootElement.append(container);
    return;
  }

  const header = documentRef.createElement('div');
  header.className = 'lafea-mesh-quality-panel__header';
  header.append(createLafeaInfoDisclosure(documentRef, 'Mesh quality evidence identity', [
    ['Retained mesh profile', panel.meshProfileIdentity],
    ['Stage', panel.stageId],
  ], { summaryText: 'Evidence (i)' }));
  if (panel.blocksAdvance) {
    const badge = documentRef.createElement('span');
    badge.className = 'lafea-mesh-quality-panel__badge-block';
    badge.setAttribute('role', 'alert');
    badge.textContent = 'MESH QUALITY BLOCKS ADVANCE';
    header.append(badge);
  }

  const list = documentRef.createElement('ul');
  list.className = 'lafea-mesh-quality-panel__list';
  for (const row of panel.rows) {
    list.append(renderQualityRow(documentRef, row, options.onFocusElement));
  }

  container.append(header, list);
  rootElement.append(container);
}

function renderQualityRow(documentRef, row, onFocusElement) {
  const item = documentRef.createElement('li');
  item.className = `lafea-mesh-quality-panel__row lafea-mesh-quality-panel__row--${row.status.toLowerCase()}`;
  item.dataset.sourcePath = row.sourcePath;
  item.dataset.metric = row.metric;
  const threshold = row.threshold ? ` · limits: ${row.threshold}` : '';
  const value = documentRef.createElement('span');
  value.textContent = `${row.label}: ${formatQualityNumber(row.metric, row.value)} ${row.unit} · ${row.status}${threshold}`;
  value.title = `Exact retained value: ${row.value}${row.threshold ? `; ${row.threshold}` : ''}`;
  item.append(value);

  if (row.status !== 'OK' && row.affectedElementIds.length && typeof onFocusElement === 'function') {
    const actions = documentRef.createElement('span');
    actions.className = 'lafea-mesh-quality-panel__focus-actions';
    actions.setAttribute('aria-label', `${row.label} affected mesh elements`);
    const visibleIds = row.affectedElementIds.slice(0, MAX_INLINE_FOCUS_ACTIONS);
    for (const elementId of visibleIds) {
      const focus = documentRef.createElement('button');
      focus.type = 'button';
      focus.className = 'lafea-mesh-quality-panel__focus';
      focus.dataset.role = 'lafea-quality-row-focus-element';
      focus.dataset.metric = row.metric;
      focus.dataset.elementId = String(elementId);
      focus.textContent = `Focus ${elementId}`;
      focus.title = `Focus retained element ${elementId} associated with this ${row.status.toLowerCase()} quality finding.`;
      focus.addEventListener('click', () => onFocusElement(elementId));
      actions.append(focus);
    }
    if (row.affectedElementIds.length > visibleIds.length) {
      const more = documentRef.createElement('span');
      more.textContent = ` +${row.affectedElementIds.length - visibleIds.length} more`;
      actions.append(more);
    }
    item.append(actions);
  }
  return item;
}

function formatQualityNumber(metric, value) {
  if (!Number.isFinite(value)) return String(value);
  if (metric === 'BOUNDARY_SEGMENT_COUNT' || metric === 'SHELL_ORIENTATION_TOPOLOGY') {
    return String(Math.round(value));
  }
  const digits = metric === 'SCALED_JACOBIAN' ? 3
    : metric === 'MINIMUM_ANGLE_DEGREES' || metric === 'SHELL_WARPAGE_DEGREES' ? 1
      : 2;
  const fixed = Number(value).toFixed(digits);
  return fixed.replace(/\.0+$/u, '').replace(/(\.\d*?[1-9])0+$/u, '$1');
}

function summarizeConfig(meshConfig) {
  const entries = Object.entries(meshConfig)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => `${key}=${value}`);
  return entries.length ? entries.join(', ') : 'unclassified settings';
}
