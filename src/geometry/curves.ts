import {assertNever, edgeContext} from './model';
import type {Point, Scene} from './model';

export const difference = (a: Point, b: Point): Point => ({x: a.x - b.x, y: a.y - b.y});

export function unit(point: Point): Point {
    const length = Math.hypot(point.x, point.y);
    return length > 1e-10 ? {x: point.x / length, y: point.y / length} : {x: 0, y: 0};
}

type Context = NonNullable<ReturnType<typeof edgeContext>>;
export type ArcGeometry =
    {
        readonly kind: 'circle';
        readonly center: Point;
        readonly radius: number;
        readonly angle: number;
        readonly sweep: number
    }
    | { readonly kind: 'straight'; readonly valid: boolean };

function baseTangent(context: Context, at: 'start' | 'end'): Point {
    const {edge, from, to} = context;
    switch (edge.shape.kind) {
        case 'line':
        case 'arc':
            return difference(to, from);
        case 'bezier': {
            const delta = at === 'start' ? difference(edge.shape.c1, from) : difference(to, edge.shape.c2);
            return {x: 3 * delta.x, y: 3 * delta.y};
        }
        default:
            return assertNever(edge.shape);
    }
}

export function arcGeometry(scene: Scene, edgeId: string): ArcGeometry {
    const context = edgeContext(scene, edgeId);
    if (!context) throw new RangeError(`Unknown edge: ${edgeId}`);
    const {edge, polygon, from, to} = context;
    if (edge.shape.kind !== 'arc') throw new TypeError(`Not an arc: ${edgeId}`);
    const atStart = from.continuity === 'G1';
    const atEnd = !atStart && to.continuity === 'G1';
    const neighbor = polygon.edges.find(current => current.id !== edge.id && (atStart ? current.to === from.id : current.from === to.id));
    const adjacent = neighbor ? edgeContext(scene, neighbor.id) : undefined;
    const start = atEnd ? to : from;
    const end = atEnd ? from : to;
    const chord = difference(end, start);
    const length = Math.hypot(chord.x, chord.y);
    if (length < 1e-10) return {kind: 'straight', valid: false};
    let center: Point;
    let sign: number;
    if ((atStart || atEnd) && adjacent?.edge.shape.kind === 'arc') {
        const a = atStart ? adjacent.from : from;
        const b = atStart ? from : to;
        const c = atStart ? to : adjacent.to;
        const u = difference(a, b), v = difference(c, b);
        const cross = u.x * v.y - u.y * v.x;
        if (Math.abs(cross) < 1e-10 * Math.max(1, Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))) {
            return {kind: 'straight', valid: u.x * v.x + u.y * v.y < 0};
        }
        const uu = u.x * u.x + u.y * u.y, vv = v.x * v.x + v.y * v.y;
        center = {x: b.x + (uu * v.y - vv * u.y) / (2 * cross), y: b.y + (u.x * vv - v.x * uu) / (2 * cross)};
        sign = Math.sign(-cross) * (atEnd ? -1 : 1);
    } else if ((atStart || atEnd) && adjacent) {
        const raw = baseTangent(adjacent, atEnd ? 'start' : 'end');
        const tangent = unit(atEnd ? {x: -raw.x, y: -raw.y} : raw);
        const normal = {x: -tangent.y, y: tangent.x};
        const projection = chord.x * normal.x + chord.y * normal.y;
        if (Math.abs(projection) < length * 1e-10) {
            return {kind: 'straight', valid: chord.x * tangent.x + chord.y * tangent.y > 0};
        }
        const curvatureRadius = length * length / (2 * projection);
        center = {x: start.x + curvatureRadius * normal.x, y: start.y + curvatureRadius * normal.y};
        sign = Math.sign(curvatureRadius);
    } else {
        center = {x: (start.x + end.x) / 2, y: (start.y + end.y) / 2};
        sign = edge.shape.flip ? -1 : 1;
    }
    const firstAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const lastAngle = Math.atan2(end.y - center.y, end.x - center.x);
    const turn = 2 * Math.PI;
    const sweep = sign > 0 ? ((lastAngle - firstAngle) % turn + turn) % turn : -((firstAngle - lastAngle) % turn + turn) % turn;
    return {
        kind: 'circle',
        center,
        radius: Math.hypot(start.x - center.x, start.y - center.y),
        angle: atEnd ? firstAngle + sweep : firstAngle,
        sweep: atEnd ? -sweep : sweep
    };
}

export function endpointTangent(scene: Scene, edgeId: string, at: 'start' | 'end'): Point {
    const context = edgeContext(scene, edgeId);
    if (!context) throw new RangeError(`Unknown edge: ${edgeId}`);
    if (context.edge.shape.kind !== 'arc') return baseTangent(context, at);
    const arc = arcGeometry(scene, edgeId);
    switch (arc.kind) {
        case 'straight':
            return difference(context.to, context.from);
        case 'circle': {
            const angle = arc.angle + (at === 'end' ? arc.sweep : 0);
            return {x: -Math.sin(angle) * arc.radius * arc.sweep, y: Math.cos(angle) * arc.radius * arc.sweep};
        }
        default:
            return assertNever(arc);
    }
}

export function sampleEdge(scene: Scene, edgeId: string, steps = 48): readonly Point[] {
    if (!Number.isFinite(steps) || steps < 1 || steps > 10000) throw new RangeError('Steps must be between 1 and 10000');
    const count = Math.floor(steps);
    const context = edgeContext(scene, edgeId);
    if (!context) throw new RangeError(`Unknown edge: ${edgeId}`);
    const {edge, from, to} = context;
    switch (edge.shape.kind) {
        case 'line':
            return [from, to];
        case 'arc': {
            const arc = arcGeometry(scene, edgeId);
            switch (arc.kind) {
                case 'straight':
                    return [from, to];
                case 'circle':
                    return Array.from({length: count + 1}, (_, index) => index === 0 ? from : index === count ? to : ({
                        x: arc.center.x + arc.radius * Math.cos(arc.angle + arc.sweep * index / count),
                        y: arc.center.y + arc.radius * Math.sin(arc.angle + arc.sweep * index / count),
                    }));
                default:
                    return assertNever(arc);
            }
        }
        case 'bezier': {
            const points: Point[] = Array.from({length: count + 1}, () => ({x: 0, y: 0}));
            const step = 1 / count;
            for (const axis of ['x', 'y'] as const) {
                const cubic = -from[axis] + 3 * edge.shape.c1[axis] - 3 * edge.shape.c2[axis] + to[axis];
                const quadratic = 3 * from[axis] - 6 * edge.shape.c1[axis] + 3 * edge.shape.c2[axis];
                const linear = 3 * (edge.shape.c1[axis] - from[axis]);
                let value = from[axis];
                let first = cubic * step ** 3 + quadratic * step ** 2 + linear * step;
                let second = 6 * cubic * step ** 3 + 2 * quadratic * step ** 2;
                const third = 6 * cubic * step ** 3;
                points.forEach((point, index) => {
                    points[index] = {...point, [axis]: index === count ? to[axis] : value};
                    value += first;
                    first += second;
                    second += third;
                });
            }
            return points;
        }
        default:
            return assertNever(edge.shape);
    }
}

export function edgeMidpoint(scene: Scene, edgeId: string): Point {
    const points = sampleEdge(scene, edgeId, 2);
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) throw new RangeError(`Empty edge: ${edgeId}`);
    return points.length === 2 ? {x: (first.x + last.x) / 2, y: (first.y + last.y) / 2} : points[1] ?? first;
}
