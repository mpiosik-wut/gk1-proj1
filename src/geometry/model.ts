export type Point = { readonly x: number; readonly y: number };
export type Continuity = 'G0' | 'G1' | 'C1';
export type Vertex = Point & { readonly id: string; readonly continuity: Continuity; readonly explicit: boolean };
export type EdgeShape =
    { readonly kind: 'line' }
    | { readonly kind: 'bezier'; readonly c1: Point; readonly c2: Point }
    | { readonly kind: 'arc'; readonly flip: boolean };
export const DEFAULT_EDGE_WIDTH = 1.7;
export const MIN_EDGE_WIDTH = 1;
export const MAX_EDGE_WIDTH = 50;
export type Edge = { readonly id: string; readonly from: string; readonly to: string; readonly shape: EdgeShape; readonly width: number };
export type Polygon = {
    readonly id: string;
    readonly name: string;
    readonly color: string;
    readonly vertices: readonly Vertex[];
    readonly edges: readonly Edge[]
};
export type Constraint =
    { readonly id: string; readonly kind: 'length'; readonly edge: string; readonly value: number }
    | { readonly id: string; readonly kind: 'perpendicular'; readonly a: string; readonly b: string };
export type Scene = { readonly polygons: readonly Polygon[]; readonly constraints: readonly Constraint[] };
export type Selection = { readonly kind: 'polygon'; readonly polygon: string } | {
    readonly kind: 'vertex';
    readonly polygon: string;
    readonly vertex: string
} | { readonly kind: 'edge'; readonly polygon: string; readonly edge: string } | {
    readonly kind: 'control';
    readonly polygon: string;
    readonly edge: string;
    readonly control: 'c1' | 'c2'
};
export type Anchor =
    { readonly polygon: string; readonly kind: 'vertex'; readonly vertex: string; readonly point: Point }
    | {
    readonly polygon: string;
    readonly kind: 'control';
    readonly edge: string;
    readonly control: 'c1' | 'c2';
    readonly point: Point
};
export const uid = () => crypto.randomUUID();

export function edgeContext(scene: Scene, id: string) {
    for (const polygon of scene.polygons) {
        const edge = polygon.edges.find(e => e.id === id);
        if (!edge) continue;
        const from = polygon.vertices.find(v => v.id === edge.from);
        const to = polygon.vertices.find(v => v.id === edge.to);
        if (from && to) return {polygon, edge, from, to};
    }
    return undefined;
}

export function assertNever(value: never): never {
    throw new TypeError(`Unexpected variant: ${String(value)}`);
}
