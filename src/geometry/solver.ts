import {assertNever} from './model';
import type {Anchor, Edge, Point, Scene} from './model';
import {magnitude, minimize} from './solver-numerics';
import {sceneResiduals} from './solver-residuals';
import {difference, unit} from './curves';

export type SolveResult = { readonly scene: Scene; readonly residual: number; readonly converged: boolean };
const vertexKey = (polygon: string, vertex: string): string => JSON.stringify([polygon, 'vertex', vertex]);
const controlKey = (polygon: string, edge: string, control: 'c1' | 'c2'): string => JSON.stringify([polygon, 'control', edge, control]);

function anchorKey(anchor: Anchor): string {
    switch (anchor.kind) {
        case 'vertex':
            return vertexKey(anchor.polygon, anchor.vertex);
        case 'control':
            return controlKey(anchor.polygon, anchor.edge, anchor.control);
        default:
            return assertNever(anchor);
    }
}

function prepare(scene: Scene, anchors: readonly Anchor[]) {
    const pinned = new Map(anchors.map(anchor => [anchorKey(anchor), {x: anchor.point.x, y: anchor.point.y}]));
    const initial: number[] = [];
    const indices = new Map<string, number>();
    const register = (key: string, point: Point) => {
        if (pinned.has(key)) return;
        indices.set(key, initial.length);
        initial.push(point.x, point.y);
    };
    for (const polygon of scene.polygons) {
        for (const vertex of polygon.vertices) register(vertexKey(polygon.id, vertex.id), vertex);
        for (const edge of polygon.edges) {
            if (edge.shape.kind !== 'bezier') continue;
            register(controlKey(polygon.id, edge.id, 'c1'), edge.shape.c1);
            register(controlKey(polygon.id, edge.id, 'c2'), edge.shape.c2);
        }
    }
    const unpack = (values: readonly number[]): Scene => {
        const point = (key: string, original: Point): Point => {
            const fixed = pinned.get(key);
            if (fixed) return fixed;
            const index = indices.get(key);
            if (index === undefined) return original;
            return {x: values[index] ?? original.x, y: values[index + 1] ?? original.y};
        };
        return {
            ...scene, polygons: scene.polygons.map(polygon => ({
                ...polygon,
                vertices: polygon.vertices.map(vertex => ({...vertex, ...point(vertexKey(polygon.id, vertex.id), vertex)})),
                edges: polygon.edges.map((edge): Edge => {
                    switch (edge.shape.kind) {
                        case 'line':
                        case 'arc':
                            return edge;
                        case 'bezier':
                            return {
                                ...edge, shape: {
                                    kind: 'bezier',
                                    c1: point(controlKey(polygon.id, edge.id, 'c1'), edge.shape.c1),
                                    c2: point(controlKey(polygon.id, edge.id, 'c2'), edge.shape.c2),
                                }
                            };
                        default:
                            return assertNever(edge.shape);
                    }
                }),
            }))
        };
    };
    return {initial, unpack};
}

function initialGuess(scene: Scene, anchors: readonly Anchor[]): Scene {
    return {
        ...scene, polygons: scene.polygons.map(polygon => ({
            ...polygon,
            vertices: polygon.vertices.map(vertex => {
                for (const anchor of anchors) {
                    switch (anchor.kind) {
                        case 'vertex':
                            break;
                        case 'control': {
                            if (anchor.polygon !== polygon.id) break;
                            const edge = polygon.edges.find(current => current.id === anchor.edge);
                            if (!edge) break;
                            const atStart = anchor.control === 'c1';
                            const endpoint = polygon.vertices.find(current => current.id === (atStart ? edge.from : edge.to));
                            if (!endpoint || endpoint.continuity !== 'G1') break;
                            const neighbor = polygon.edges.find(current => current.id !== edge.id && current.shape.kind === 'line'
                                && (atStart ? current.to === endpoint.id && current.from === vertex.id : current.from === endpoint.id && current.to === vertex.id));
                            if (!neighbor) break;
                            const desired = unit(atStart ? difference(anchor.point, endpoint) : difference(endpoint, anchor.point));
                            const chord = atStart ? difference(endpoint, vertex) : difference(vertex, endpoint);
                            const direction = unit(chord);
                            if (direction.x * desired.x + direction.y * desired.y > -0.999999) break;
                            const length = Math.hypot(chord.x, chord.y) * (atStart ? -1 : 1);
                            return {...vertex, x: endpoint.x + desired.x * length, y: endpoint.y + desired.y * length};
                        }
                        default:
                            assertNever(anchor);
                    }
                }
                return vertex;
            }),
            edges: polygon.edges.map((edge): Edge => {
                switch (edge.shape.kind) {
                    case 'line':
                    case 'arc':
                        return edge;
                    case 'bezier': {
                        const shape = edge.shape;
                        const translated = (control: 'c1' | 'c2'): Point => {
                            const vertex = polygon.vertices.find(current => current.id === (control === 'c1' ? edge.from : edge.to));
                            const anchor = anchors.find(current => current.kind === 'vertex' && current.polygon === polygon.id && current.vertex === vertex?.id);
                            const point = shape[control];
                            return anchor && vertex ? {
                                x: point.x + anchor.point.x - vertex.x,
                                y: point.y + anchor.point.y - vertex.y
                            } : point;
                        };
                        return {...edge, shape: {kind: 'bezier', c1: translated('c1'), c2: translated('c2')}};
                    }
                    default:
                        return assertNever(edge.shape);
                }
            }),
        }))
    };
}

export function solveScene(scene: Scene, anchors: readonly Anchor[] = []): SolveResult {
    if (anchors.some(anchor => !Number.isFinite(anchor.point.x) || !Number.isFinite(anchor.point.y))) {
        return {scene, residual: Infinity, converged: false};
    }
    const problem = prepare(initialGuess(scene, anchors), anchors);
    if (!problem.initial.every(Number.isFinite)) return {scene, residual: Infinity, converged: false};
    const values = minimize(problem.initial, coordinates => sceneResiduals(problem.unpack(coordinates)));
    const solved = problem.unpack(values);
    const residual = magnitude(sceneResiduals(solved));
    return {scene: solved, residual, converged: residual < 1e-3};
}

export function moveAnchor(scene: Scene, anchor: Anchor): SolveResult {
    switch (anchor.kind) {
        case 'vertex':
            return solveScene(scene, [anchor]);
        case 'control': {
            const polygon = scene.polygons.find(current => current.id === anchor.polygon);
            const edge = polygon?.edges.find(current => current.id === anchor.edge);
            if (!polygon || !edge || edge.shape.kind !== 'bezier') return {scene, residual: Infinity, converged: false};
            const endpoints: Anchor[] = polygon.vertices.filter(vertex => vertex.id === edge.from || vertex.id === edge.to)
                .map(vertex => ({
                    kind: 'vertex',
                    polygon: polygon.id,
                    vertex: vertex.id,
                    point: {x: vertex.x, y: vertex.y}
                }));
            const pinned = solveScene(scene, [...endpoints, anchor]);
            return pinned.converged ? pinned : solveScene(scene, [anchor]);
        }
        default:
            return assertNever(anchor);
    }
}
