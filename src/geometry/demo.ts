import type {Constraint, Continuity, EdgeShape, Point, Polygon, Scene} from './model';
import {DEFAULT_EDGE_WIDTH} from './model';
import {solveScene} from './solver';

type DemoPolygon = {
    readonly id: string;
    readonly name: string;
    readonly color: string;
    readonly vertices: readonly (Point & {readonly continuity?: Continuity; readonly explicit?: boolean})[];
    readonly shapes?: Readonly<Partial<Record<number, EdgeShape>>>;
    readonly widths?: Readonly<Partial<Record<number, number>>>;
};

function demoPolygon(spec: DemoPolygon): Polygon {
    const vertices = spec.vertices.map((point, index) => ({
        x: point.x, y: point.y, id: `${spec.id}-${index}`,
        continuity: point.continuity ?? 'G0',
        explicit: point.explicit ?? point.continuity !== undefined
    }));
    return {
        id: `demo-${spec.id}`, name: spec.name, color: spec.color, vertices,
        edges: vertices.map((vertex, index) => ({
            id: `${spec.id}-e${index}`, from: vertex.id,
            to: vertices[(index + 1) % vertices.length]!.id,
            shape: spec.shapes?.[index] ?? {kind: 'line'},
            width: spec.widths?.[index] ?? DEFAULT_EDGE_WIDTH
        }))
    };
}

export function createDemo(): Scene {
    // Top left: C1 matches the entire derivative, including its length.
    const c1 = demoPolygon({
        id: 'main', name: 'Bézier · C1', color: '#3567b7',
        vertices: [
            {x: 100, y: 80},
            {x: 260, y: 80, continuity: 'C1', explicit: false},
            {x: 380, y: 220, continuity: 'C1', explicit: false},
            {x: 380, y: 320},
            {x: 180, y: 350},
            {x: 60, y: 240}
        ],
        shapes: {
            1: {kind: 'bezier', c1: {x: 260 + 160 / 3, y: 80}, c2: {x: 380, y: 220 - 100 / 3}}
        },
        widths: {1: 2.5}
    });

    // Top right: G1 keeps tangent directions, with deliberately unequal lengths.
    const g1 = demoPolygon({
        id: 'g1', name: 'Bézier · G1', color: '#986023',
        vertices: [
            {x: 560, y: 80},
            {x: 720, y: 80, continuity: 'G1'},
            {x: 840, y: 220, continuity: 'G1'},
            {x: 840, y: 320},
            {x: 560, y: 320}
        ],
        shapes: {1: {kind: 'bezier', c1: {x: 810, y: 80}, c2: {x: 840, y: 195}}},
        widths: {1: 2.5}
    });

    // Bottom left: two arcs share a G1 join at the top. The bottom arc has
    // G0 at both ends, so it is a semicircle with radius half its chord.
    const arcs = demoPolygon({
        id: 'arc', name: 'Łuki · G1 i G0', color: '#568275',
        vertices: [
            {x: 100, y: 500},
            {x: 200, y: 420, continuity: 'G1'},
            {x: 300, y: 500},
            {x: 300, y: 650},
            {x: 100, y: 650}
        ],
        shapes: {
            0: {kind: 'arc', flip: false},
            1: {kind: 'arc', flip: false},
            3: {kind: 'arc', flip: true}
        },
        widths: {0: 3, 1: 3, 3: 3}
    });

    // Bottom right: a bow tie demonstrates editing and filling self-intersections.
    const crossing = demoPolygon({
        id: 'cross', name: 'Samoprzecięcie', color: '#8b5aa5',
        vertices: [
            {x: 560, y: 440},
            {x: 840, y: 650},
            {x: 560, y: 650},
            {x: 840, y: 440}
        ]
    });

    const constraints: readonly Constraint[] = [
        {id: 'demo-length-0', kind: 'length', edge: 'main-e0', value: 160},
        {id: 'demo-length-2', kind: 'length', edge: 'main-e2', value: 100},
        {id: 'demo-perpendicular', kind: 'perpendicular', a: 'main-e0', b: 'main-e2'},
        {id: 'demo-cross-perpendicular', kind: 'perpendicular', a: 'main-e0', b: 'g1-e4'}
    ];
    return solveScene({polygons: [c1, g1, arcs, crossing], constraints}).scene;
}
