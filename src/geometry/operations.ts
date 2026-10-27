import {assertNever, DEFAULT_EDGE_WIDTH, edgeContext, MAX_EDGE_WIDTH, MIN_EDGE_WIDTH, uid} from './model';
import type {Constraint, Continuity, Edge, EdgeShape, Point, Polygon, Scene, Vertex} from './model';
import {edgeMidpoint} from './curves';

const midpoint = (a: Point, b: Point): Point => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
const offset = (point: Point, delta: Point): Point => ({x: point.x + delta.x, y: point.y + delta.y});

function normalize(polygon: Polygon): Polygon {
    const vertices = polygon.vertices.map(vertex => {
        const adjacent = polygon.edges.filter(edge => edge.from === vertex.id || edge.to === vertex.id);
        const hasArc = adjacent.some(edge => edge.shape.kind === 'arc');
        const continuity = hasArc
            ? (vertex.explicit && vertex.continuity === 'G1' ? 'G1' : 'G0')
            : (vertex.explicit ? vertex.continuity : adjacent.some(edge => edge.shape.kind === 'bezier') ? 'C1' : 'G0');
        return continuity === vertex.continuity ? vertex : {...vertex, continuity};
    });
    const cleared = new Set<string>();
    for (const edge of polygon.edges) {
        if (edge.shape.kind !== 'arc') continue;
        const from = vertices.find(vertex => vertex.id === edge.from);
        const to = vertices.find(vertex => vertex.id === edge.to);
        if (from?.continuity === 'G1' && to?.continuity === 'G1') cleared.add(to.id);
    }
    return {
        ...polygon,
        vertices: vertices.map(vertex => cleared.has(vertex.id) ? {
            ...vertex,
            continuity: 'G0',
            explicit: true
        } : vertex),
    };
}

function replacePolygon(scene: Scene, polygon: Polygon): Scene {
    return {
        ...scene,
        polygons: scene.polygons.map(current => current.id === polygon.id ? normalize(polygon) : current)
    };
}

function retainConstraints(constraints: readonly Constraint[], removed: ReadonlySet<string>): readonly Constraint[] {
    return constraints.filter(constraint => {
        switch (constraint.kind) {
            case 'length':
                return !removed.has(constraint.edge);
            case 'perpendicular':
                return !removed.has(constraint.a) && !removed.has(constraint.b);
            default:
                return assertNever(constraint);
        }
    });
}

export function createPolygon(points: readonly Point[], index: number): Polygon {
    if (points.length < 3) throw new RangeError('A polygon requires at least three points');
    const vertices: readonly Vertex[] = points.map(point => ({...point, id: uid(), continuity: 'G0', explicit: false}));
    const edges = vertices.flatMap((vertex, position): Edge[] => {
        const next = vertices[(position + 1) % vertices.length];
        return next ? [{id: uid(), from: vertex.id, to: next.id, shape: {kind: 'line'}, width: DEFAULT_EDGE_WIDTH}] : [];
    });
    return {id: uid(), name: `Polygon ${index + 1}`, color: index % 2 === 0 ? '#3567b7' : '#568275', vertices, edges};
}

export function addVertex(scene: Scene, edgeId: string): Scene {
    const context = edgeContext(scene, edgeId);
    if (!context) return scene;
    const {polygon, edge, from, to} = context;
    let point: Point;
    let left: EdgeShape;
    let right: EdgeShape;
    switch (edge.shape.kind) {
        case 'line':
            point = midpoint(from, to);
            left = right = {kind: 'line'};
            break;
        case 'bezier': {
            const first = midpoint(from, edge.shape.c1);
            const middle = midpoint(edge.shape.c1, edge.shape.c2);
            const last = midpoint(edge.shape.c2, to);
            const leftControl = midpoint(first, middle);
            const rightControl = midpoint(middle, last);
            point = midpoint(leftControl, rightControl);
            left = {kind: 'bezier', c1: first, c2: leftControl};
            right = {kind: 'bezier', c1: rightControl, c2: last};
            break;
        }
        case 'arc': {
            point = edgeMidpoint(scene, edgeId);
            left = right = {kind: 'arc', flip: edge.shape.flip};
            break;
        }
        default:
            return assertNever(edge.shape);
    }
    const vertex: Vertex = {...point, id: uid(), continuity: 'G0', explicit: false};
    const first: Edge = {id: uid(), from: edge.from, to: vertex.id, shape: left, width: edge.width};
    const second: Edge = {id: uid(), from: vertex.id, to: edge.to, shape: right, width: edge.width};
    const updated = replacePolygon(scene, {
        ...polygon,
        vertices: polygon.vertices.flatMap(current => current.id === from.id ? [current, vertex] : [current]),
        edges: polygon.edges.flatMap(current => current.id === edgeId ? [first, second] : [current]),
    });
    return {...updated, constraints: retainConstraints(scene.constraints, new Set([edgeId]))};
}

export function removeVertex(scene: Scene, vertexId: string): Scene {
    const polygon = scene.polygons.find(current => current.vertices.some(vertex => vertex.id === vertexId));
    if (!polygon || polygon.vertices.length <= 3) return scene;
    const incoming = polygon.edges.find(edge => edge.to === vertexId);
    const outgoing = polygon.edges.find(edge => edge.from === vertexId);
    if (!incoming || !outgoing) return scene;
    const replacement: Edge = {id: uid(), from: incoming.from, to: outgoing.to, shape: {kind: 'line'}, width: incoming.width};
    const updated = replacePolygon(scene, {
        ...polygon,
        vertices: polygon.vertices.filter(vertex => vertex.id !== vertexId),
        edges: polygon.edges.flatMap(edge => edge.id === incoming.id ? [replacement] : edge.id === outgoing.id ? [] : [edge]),
    });
    return {...updated, constraints: retainConstraints(scene.constraints, new Set([incoming.id, outgoing.id]))};
}

export function setEdgeWidth(scene: Scene, edgeId: string, width: number): Scene {
    const context = edgeContext(scene, edgeId);
    if (!context || !Number.isFinite(width) || width < MIN_EDGE_WIDTH || width > MAX_EDGE_WIDTH || context.edge.width === width) return scene;
    return {
        ...scene,
        polygons: scene.polygons.map(polygon => polygon.id === context.polygon.id ? {
            ...polygon,
            edges: polygon.edges.map(edge => edge.id === edgeId ? {...edge, width} : edge)
        } : polygon)
    };
}

export function setEdgeKind(scene: Scene, edgeId: string, kind: 'line' | 'bezier' | 'arc'): Scene {
    const context = edgeContext(scene, edgeId);
    if (!context || context.edge.shape.kind === kind) return scene;
    const {polygon, edge, from, to} = context;
    let shape: EdgeShape;
    switch (kind) {
        case 'line':
            shape = {kind};
            break;
        case 'arc':
            shape = {kind, flip: false};
            break;
        case 'bezier':
            shape = {
                kind,
                c1: {x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3},
                c2: {x: from.x + 2 * (to.x - from.x) / 3, y: from.y + 2 * (to.y - from.y) / 3},
            };
            break;
        default:
            return assertNever(kind);
    }
    return replacePolygon(scene, {
        ...polygon,
        edges: polygon.edges.map(current => current.id === edgeId ? {...edge, shape} : current)
    });
}

export function setContinuity(scene: Scene, vertexId: string, continuity: Continuity): Scene {
    const polygon = scene.polygons.find(current => current.vertices.some(vertex => vertex.id === vertexId));
    if (!polygon) return scene;
    const arcs = polygon.edges.filter(edge => edge.shape.kind === 'arc' && (edge.from === vertexId || edge.to === vertexId));
    const cleared = new Set<string>();
    switch (continuity) {
        case 'C1':
            if (arcs.length > 0) return scene;
            break;
        case 'G1':
            for (const edge of arcs) cleared.add(edge.from === vertexId ? edge.to : edge.from);
            break;
        case 'G0':
            break;
        default:
            return assertNever(continuity);
    }
    return replacePolygon(scene, {
        ...polygon,
        vertices: polygon.vertices.map(vertex => vertex.id === vertexId
            ? {...vertex, continuity, explicit: true}
            : cleared.has(vertex.id) ? {...vertex, continuity: 'G0', explicit: true} : vertex),
    });
}

export function translatePolygon(scene: Scene, polygonId: string, delta: Point): Scene {
    const polygon = scene.polygons.find(current => current.id === polygonId);
    if (!polygon || (delta.x === 0 && delta.y === 0)) return scene;
    const edges = polygon.edges.map((edge): Edge => {
        switch (edge.shape.kind) {
            case 'line':
            case 'arc':
                return edge;
            case 'bezier':
                return {
                    ...edge,
                    shape: {kind: 'bezier', c1: offset(edge.shape.c1, delta), c2: offset(edge.shape.c2, delta)}
                };
            default:
                return assertNever(edge.shape);
        }
    });
    const moved = {
        ...polygon,
        vertices: polygon.vertices.map(vertex => ({...vertex, ...offset(vertex, delta)})),
        edges
    };
    return {...scene, polygons: scene.polygons.map(current => current.id === polygonId ? moved : current)};
}

export function removePolygon(scene: Scene, polygonId: string): Scene {
    const polygon = scene.polygons.find(current => current.id === polygonId);
    if (!polygon) return scene;
    return {
        ...scene,
        polygons: scene.polygons.filter(current => current.id !== polygonId),
        constraints: retainConstraints(scene.constraints, new Set(polygon.edges.map(edge => edge.id))),
    };
}
