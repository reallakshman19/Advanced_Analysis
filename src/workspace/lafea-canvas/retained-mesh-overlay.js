/** Read-only SVG overlays for canonical retained analysis-mesh evidence. */
const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderLafeaRetainedMeshOverlay(input) {
  const svg = input?.target?.querySelector?.('svg');
  if (!svg || !input.evidence || !input.viewport) return null;
  const mesh = input.evidence.mesh;
  if (!Array.isArray(mesh?.nodes) || !Array.isArray(mesh?.elements)) throw new TypeError('LAFEA_RETAINED_MESH_OVERLAY_EVIDENCE_INVALID');
  const transform = viewportTransform(input.viewport);
  const nodeMap = new Map(mesh.nodes.map((node) => [node.nodeId, node]));
  const warning = new Set(input.evidence.quality?.warningElementIds ?? []);
  const blocking = new Set(input.evidence.quality?.blockingElementIds ?? []);
  const focused = input.focusedElementId == null ? null : String(input.focusedElementId);
  svg.querySelector?.('[data-role="lafea-retained-mesh-overlay"]')?.remove();
  const group = svg.ownerDocument.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'lafea-retained-mesh'); group.dataset.role = 'lafea-retained-mesh-overlay';
  group.dataset.custodyState = input.custodyState ?? 'UNKNOWN'; group.setAttribute('aria-label', 'Retained authorized analysis mesh');
  for (const element of mesh.elements) {
    const points = element.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean); if (points.length < 2) continue;
    const shape = svg.ownerDocument.createElementNS(SVG_NS, points.length > 2 ? 'polygon' : 'polyline');
    shape.setAttribute('points', points.map((point) => screenPoint(point, transform).join(',')).join(' '));
    const id = String(element.elementId), classes = ['lafea-retained-mesh__element'];
    if (warning.has(element.elementId)) classes.push('lafea-retained-mesh__element--warning');
    if (blocking.has(element.elementId)) classes.push('lafea-retained-mesh__element--block');
    if (id === focused) classes.push('lafea-retained-mesh__element--focused');
    shape.setAttribute('class', classes.join(' ')); shape.dataset.meshElementId = id;
    shape.setAttribute('tabindex', '0'); shape.setAttribute('role', 'button'); shape.setAttribute('aria-label', `Analysis mesh element ${id}`);
    const focus = () => input.onFocusElement?.(element.elementId);
    shape.addEventListener('click', (event) => { event.stopPropagation(); focus(); });
    shape.addEventListener('keydown', (event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); focus(); });
    group.append(shape);
  }
  svg.append(group); return group;
}

export function renderLafeaBcLoadGlyphOverlay(input) {
  const svg = input?.target?.querySelector?.('svg'), projection = input?.projection, mesh = input?.evidence?.mesh;
  if (!svg || !projection || !Array.isArray(mesh?.nodes) || !Array.isArray(mesh?.elements)) return null;
  if (projection.executionHash !== input.executionHash) throw new TypeError('LAFEA_BC_LOAD_GLYPH_EXECUTION_MISMATCH');
  const nodeMap = new Map(mesh.nodes.map((node) => [node.nodeId, node]));
  const elementMap = new Map(mesh.elements.map((element) => [element.elementId, element]));
  const transform = viewportTransform(input.viewport);
  svg.querySelector?.('[data-role="lafea-bc-load-glyph-overlay"]')?.remove();
  const group = svg.ownerDocument.createElementNS(SVG_NS, 'g');
  group.dataset.role = 'lafea-bc-load-glyph-overlay'; group.dataset.executionHash = projection.executionHash;
  group.dataset.canonicalInputHash = projection.canonicalExecutionInputHash;
  group.setAttribute('class', 'lafea-bc-load-glyphs'); group.setAttribute('aria-label', 'Canonical restraints and loads used by the solved execution');
  for (const glyph of projection.glyphs ?? []) {
    const world = glyphLocation(glyph, nodeMap, elementMap); if (!world) continue;
    const [x, y] = screenPoint(world, transform), node = svg.ownerDocument.createElementNS(SVG_NS, glyph.kind === 'RESTRAINT' ? 'rect' : 'circle');
    if (glyph.kind === 'RESTRAINT') { node.setAttribute('x', x - 5); node.setAttribute('y', y - 5); node.setAttribute('width', '10'); node.setAttribute('height', '10'); }
    else { node.setAttribute('cx', x); node.setAttribute('cy', y); node.setAttribute('r', '5'); }
    node.setAttribute('class', `lafea-bc-load-glyph lafea-bc-load-glyph--${glyph.kind.toLowerCase()}`);
    node.dataset.glyphId = glyph.glyphId; node.dataset.glyphKind = glyph.kind;
    node.dataset.loadCaseId = glyph.loadCaseId ?? ''; node.dataset.authority = glyph.authority;
    node.dataset.canonicalInputHash = projection.canonicalExecutionInputHash;
    node.setAttribute('aria-label', `${glyph.kind} ${glyph.glyphId}`); group.append(node);
  }
  svg.append(group); return group;
}

export function focusLafeaRetainedMeshElement(target, elementId) {
  const id = String(elementId), nodes = target?.querySelectorAll?.('[data-mesh-element-id]') ?? []; let found = null;
  nodes.forEach((node) => { const selected = node.dataset.meshElementId === id; node.classList.toggle('lafea-retained-mesh__element--focused', selected); if (selected) found = node; });
  found?.focus?.({ preventScroll: true }); return found !== null;
}

function glyphLocation(glyph, nodes, elements) {
  if (glyph.nodeId && nodes.has(glyph.nodeId)) return nodes.get(glyph.nodeId);
  const edge = glyph.payload?.edgeNodeIds;
  if (Array.isArray(edge) && edge.length >= 2) return centroid(edge.map((id) => nodes.get(id)).filter(Boolean));
  const element = elements.get(glyph.elementId); return element ? centroid(element.nodeIds.map((id) => nodes.get(id)).filter(Boolean)) : null;
}
function centroid(points) { if (!points.length) return null; return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length }; }
function viewportTransform(viewport) {
  const bounds = viewport.worldBounds, width = viewport.cssWidth, height = viewport.cssHeight;
  const minX = bounds?.minimum?.x, maxX = bounds?.maximum?.x, minY = bounds?.minimum?.y, maxY = bounds?.maximum?.y;
  if (![width, height, minX, maxX, minY, maxY].every(Number.isFinite) || width <= 0 || height <= 0 || maxX <= minX || maxY <= minY) throw new TypeError('LAFEA_RETAINED_MESH_OVERLAY_VIEWPORT_INVALID');
  return { x: (value) => (value - minX) * width / (maxX - minX), y: (value) => height - (value - minY) * height / (maxY - minY) };
}
function screenPoint(node, transform) { if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y)) throw new TypeError('LAFEA_RETAINED_MESH_OVERLAY_NODE_INVALID'); return [transform.x(node.x), transform.y(node.y)]; }
