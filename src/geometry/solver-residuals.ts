import {arcGeometry, difference, endpointTangent, unit} from './curves';
import {assertNever} from './model';
import type {Point, Scene} from './model';

export function sceneResiduals(scene: Scene): readonly number[] {
    const residuals: number[] = [];
    const chords = new Map<string, Point>();
    for (const polygon of scene.polygons) {
        for (const edge of polygon.edges) {
            const from = polygon.vertices.find(vertex => vertex.id === edge.from);
            const to = polygon.vertices.find(vertex => vertex.id === edge.to);
            if (!from || !to) {
                residuals.push(1000);
                continue;
            }
            chords.set(edge.id, difference(to, from));
            if (edge.shape.kind === 'arc') {
                const arc = arcGeometry(scene, edge.id);
                residuals.push(arc.kind === 'straight' && !arc.valid ? 100 : 0);
            }
        }
        for (const vertex of polygon.vertices) {
            const incoming = polygon.edges.find(edge => edge.to === vertex.id);
            const outgoing = polygon.edges.find(edge => edge.from === vertex.id);
            if (!incoming || !outgoing || (incoming.shape.kind === 'line' && outgoing.shape.kind === 'line')) continue;
            const before = endpointTangent(scene, incoming.id, 'end');
            const after = endpointTangent(scene, outgoing.id, 'start');
            switch (vertex.continuity) {
                case 'G0':
                    break;
                case 'C1':
                    residuals.push(before.x - after.x, before.y - after.y);
                    break;
                case 'G1': {
                    const first = unit(before);
                    const second = unit(after);
                    residuals.push(100 * (first.x - second.x), 100 * (first.y - second.y));
                    residuals.push(Math.hypot(before.x, before.y) < 1e-10 || Math.hypot(after.x, after.y) < 1e-10 ? 100 : 0);
                    break;
                }
                default:
                    assertNever(vertex.continuity);
            }
        }
    }
    for (const constraint of scene.constraints) {
        switch (constraint.kind) {
            case 'length': {
                const chord = chords.get(constraint.edge);
                residuals.push(chord ? Math.hypot(chord.x, chord.y) - constraint.value : 1000);
                break;
            }
            case 'perpendicular': {
                const first = chords.get(constraint.a);
                const second = chords.get(constraint.b);
                if (!first || !second) {
                    residuals.push(1000);
                    break;
                }
                const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
                residuals.push(denominator > 1e-10 ? 100 * (first.x * second.x + first.y * second.y) / denominator : 100);
                break;
            }
            default:
                assertNever(constraint);
        }
    }
    return residuals;
}
