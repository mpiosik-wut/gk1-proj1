import {edgeContext} from '../geometry/model';
import type {Point, Scene, Selection} from '../geometry/model';
import {edgeMidpoint, sampleEdge} from '../geometry/curves';
import {drawPolyline, screenPoint} from './raster';
import type {LineAlgorithm, View} from './raster';

export type Drawing = {
    readonly scene: Scene;
    readonly selected: Selection | null;
    readonly pair: readonly string[];
    readonly view: View;
    readonly algorithm: LineAlgorithm;
    readonly antialiasing: boolean;
    readonly draft: readonly Point[];
    readonly guides: boolean
};

export function renderScene(context: CanvasRenderingContext2D, drawing: Drawing) {
    const {scene, selected, pair, view, algorithm, antialiasing, draft, guides} = drawing;
    const width = context.canvas.clientWidth, height = context.canvas.clientHeight;
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#dfe4ec';
    const step = Math.max(12, 24 * view.scale);
    for (let x = view.x % step; x < width; x += step) for (let y = view.y % step; y < height; y += step) context.fillRect(x, y, 1, 1);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.font = '11px system-ui';
    for (const polygon of scene.polygons) {
        const outline = polygon.edges.flatMap(edge => sampleEdge(scene, edge.id, 96).map(p => screenPoint(p, view)));
        context.beginPath();
        outline.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
        context.closePath();
        context.fillStyle = `${polygon.color}0b`;
        context.fill('evenodd');
        for (const edge of polygon.edges) {
            const active = (selected?.kind === 'edge' || selected?.kind === 'control') && selected.edge === edge.id;
            const highlighted = active || pair.includes(edge.id);
            context.strokeStyle = highlighted ? '#38bdf8' : polygon.color;
            context.fillStyle = context.strokeStyle;
            context.lineWidth = edge.width + (highlighted ? 3 : 0);
            drawPolyline(context, sampleEdge(scene, edge.id, 160).map(p => screenPoint(p, view)), algorithm, antialiasing && edge.shape.kind !== 'bezier');
            if (edge.shape.kind === 'bezier' && guides) {
                const info = edgeContext(scene, edge.id);
                if (!info) continue;
                context.strokeStyle = '#bd641d';
                context.lineWidth = 1;
                context.setLineDash([5, 5]);
                drawPolyline(context, [info.from, edge.shape.c1, edge.shape.c2, info.to].map(p => screenPoint(p, view)), 'library');
                context.setLineDash([]);
                for (const name of ['c1', 'c2'] as const) {
                    const p = screenPoint(edge.shape[name], view);
                    context.fillStyle = '#ffffff';
                    context.fillRect(p.x - 4, p.y - 4, 8, 8);
                    context.strokeStyle = '#bd641d';
                    context.strokeRect(p.x - 4, p.y - 4, 8, 8);
                    if (selected?.kind === 'control' && selected.edge === edge.id && selected.control === name) {
                        context.fillStyle = '#bd641d';
                        context.fillRect(p.x - 3, p.y - 3, 6, 6);
                    }
                }
            }
            const markers = scene.constraints.filter(c => c.kind === 'length' ? c.edge === edge.id : c.a === edge.id || c.b === edge.id);
            if (markers.length) {
                const mid = edgeMidpoint(scene, edge.id);
                if (mid) {
                    const p = screenPoint(mid, view);
                    const label = markers.map(c => c.kind === 'length' ? `${c.value.toFixed(0)} px` : `⊥${scene.constraints.filter(r => r.kind === 'perpendicular').findIndex(r => r.id === c.id) + 1}`).join(' · ');
                    const textWidth = context.measureText(label).width;
                    context.fillStyle = '#ffffff';
                    context.fillRect(p.x - textWidth / 2 - 5, p.y - 23, textWidth + 10, 17);
                    context.fillStyle = '#2457a6';
                    context.fillText(label, p.x - textWidth / 2, p.y - 11);
                }
            }
        }
        for (const vertex of polygon.vertices) {
            const p = screenPoint(vertex, view);
            const active = selected?.kind === 'vertex' && selected.vertex === vertex.id;
            context.beginPath();
            context.arc(p.x, p.y, active ? 6 : 4, 0, 2 * Math.PI);
            context.fillStyle = active ? '#2457a6' : '#ffffff';
            context.fill();
            context.strokeStyle = polygon.color;
            context.lineWidth = 1.7;
            context.stroke();
            if (vertex.continuity !== 'G0') {
                context.fillStyle = '#657080';
                context.fillText(vertex.continuity, p.x + 10, p.y - 9);
            }
        }
        const first = polygon.vertices[0];
        if (first) {
            const p = screenPoint(first, view);
            context.fillStyle = '#657080';
            context.fillText(polygon.name, p.x + 10, p.y + 23);
        }
    }
    if (draft.length) {
        context.strokeStyle = '#20252d';
        context.fillStyle = '#20252d';
        context.lineWidth = 1.5;
        context.setLineDash([5, 5]);
        drawPolyline(context, draft.map(p => screenPoint(p, view)), 'library');
        context.setLineDash([]);
        for (const p of draft.map(p => screenPoint(p, view))) {
            context.beginPath();
            context.arc(p.x, p.y, 4, 0, Math.PI * 2);
            context.fill();
        }
    }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function hitScene(drawing: Drawing, pointer: Point): Selection | null {
    const {scene, view, guides} = drawing;
    for (const polygon of [...scene.polygons].reverse()) {
        if (guides) for (const edge of polygon.edges) if (edge.shape.kind === 'bezier') {
            for (const control of ['c1', 'c2'] as const) if (distance(screenPoint(edge.shape[control], view), pointer) <= 10) return {
                kind: 'control',
                polygon: polygon.id,
                edge: edge.id,
                control
            };
        }
        for (const vertex of polygon.vertices) if (distance(screenPoint(vertex, view), pointer) <= 10) return {
            kind: 'vertex',
            polygon: polygon.id,
            vertex: vertex.id
        };
        for (const edge of polygon.edges) {
            const points = sampleEdge(scene, edge.id, 96).map(p => screenPoint(p, view));
            for (let i = 1; i < points.length; i++) {
                const a = points[i - 1], b = points[i];
                if (!a || !b) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                const t = Math.max(0, Math.min(1, ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
                if (distance(pointer, {x: a.x + dx * t, y: a.y + dy * t}) <= Math.max(8, edge.width / 2 + 3)) return {
                    kind: 'edge',
                    polygon: polygon.id,
                    edge: edge.id
                };
            }
        }
        const outline = polygon.edges.flatMap(edge => sampleEdge(scene, edge.id, 48).map(p => screenPoint(p, view)));
        let inside = false;
        for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
            const a = outline[i], b = outline[j];
            if (!a || !b) continue;
            if ((a.y > pointer.y) !== (b.y > pointer.y) && pointer.x < (b.x - a.x) * (pointer.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        if (inside) return {kind: 'polygon', polygon: polygon.id};
    }
    return null;
}
