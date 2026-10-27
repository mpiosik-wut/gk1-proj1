import {z} from 'zod';
import {DEFAULT_EDGE_WIDTH, MAX_EDGE_WIDTH, MIN_EDGE_WIDTH} from './model';
import type {Scene} from './model';
import type {LineAlgorithm} from '../render/raster';

const id = z.string().min(1).max(200);
const coordinate = z.number().min(-1_000_000).max(1_000_000);
const point = z.object({x: coordinate, y: coordinate});
const vertex = point.extend({id, continuity: z.enum(['G0', 'G1', 'C1']), explicit: z.boolean()});
const edge = z.object({
    id, from: id, to: id,
    width: z.number().min(MIN_EDGE_WIDTH).max(MAX_EDGE_WIDTH).default(DEFAULT_EDGE_WIDTH),
    shape: z.discriminatedUnion('kind', [
        z.object({kind: z.literal('line')}),
        z.object({kind: z.literal('arc'), flip: z.boolean()}),
        z.object({kind: z.literal('bezier'), c1: point, c2: point})
    ])
});
const sceneSchema = z.object({
    polygons: z.array(z.object({
        id, name: z.string().min(1).max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        vertices: z.array(vertex).min(3).max(1000),
        edges: z.array(edge).min(3).max(1000)
    })).max(100),
    constraints: z.array(z.discriminatedUnion('kind', [
        z.object({id, kind: z.literal('length'), edge: id, value: z.number().positive().max(20000)}),
        z.object({id, kind: z.literal('perpendicular'), a: id, b: id})
    ])).max(2000)
}).superRefine((scene, ctx) => {
    const ids = new Set<string>(), edges = new Set<string>();
    const invalid = (message: string) => ctx.addIssue({code: 'custom', message});
    const unique = (value: string) => {
        if (ids.has(value)) invalid(`Powtórzony identyfikator: ${value}`);
        ids.add(value);
    };
    if (scene.polygons.reduce((sum, p) => sum + p.vertices.length, 0) > 1000) invalid('Zbyt wiele wierzchołków.');
    for (const polygon of scene.polygons) {
        unique(polygon.id);
        polygon.vertices.forEach(v => unique(v.id));
        if (polygon.edges.length !== polygon.vertices.length) invalid('Nieprawidłowy obrys wielokąta.');
        polygon.edges.forEach((e, i) => {
            unique(e.id);
            edges.add(e.id);
            if (e.from !== polygon.vertices[i]?.id || e.to !== polygon.vertices[(i + 1) % polygon.vertices.length]?.id) {
                invalid('Krawędzie nie tworzą zamkniętego wielokąta.');
            }
            if (e.shape.kind === 'arc') {
                const from = polygon.vertices[i], to = polygon.vertices[(i + 1) % polygon.vertices.length];
                if (from?.continuity === 'C1' || to?.continuity === 'C1' || (from?.continuity === 'G1' && to?.continuity === 'G1')) {
                    invalid('Nieprawidłowa ciągłość łuku.');
                }
            }
        });
    }
    for (const constraint of scene.constraints) {
        unique(constraint.id);
        if (constraint.kind === 'length' ? !edges.has(constraint.edge) : !edges.has(constraint.a) || !edges.has(constraint.b) || constraint.a === constraint.b) {
            invalid('Relacja wskazuje nieprawidłową krawędź.');
        }
    }
});
const settingsSchema = z.object({
    algorithm: z.enum(['library', 'bresenham']),
    antialiasing: z.boolean(),
    guides: z.boolean()
});
const documentSchema = z.object({
    format: z.literal('polygon-studio'), version: z.literal(1),
    name: z.string().trim().min(1).max(120).optional(),
    scene: sceneSchema, settings: settingsSchema
});

export type RenderSettings = {readonly algorithm: LineAlgorithm; readonly antialiasing: boolean; readonly guides: boolean};
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const DEFAULT_FILE_NAME = 'Bez nazwy';

export function normalizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().replace(/(?:\.json)+$/i, '').trim().slice(0, 120) || DEFAULT_FILE_NAME;
}

export function serializeScene(scene: Scene, settings: RenderSettings, name?: string): string {
    return JSON.stringify({format: 'polygon-studio', version: 1, scene, settings, ...(name === undefined ? {} : {name: normalizeFileName(name)})}, null, 2);
}

export function parseScene(text: string): {scene: Scene; settings: RenderSettings; name?: string} {
    try {
        const {scene, settings, name} = documentSchema.parse(JSON.parse(text));
        return {scene, settings, ...(name === undefined ? {} : {name: normalizeFileName(name)})};
    } catch {
        throw new Error('Nieprawidłowy plik Polygon Studio. Wybierz plik JSON utworzony przez funkcję Eksportuj.');
    }
}
