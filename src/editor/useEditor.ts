import {useRef, useState} from 'react';
import type {PointerEvent} from 'react';
import type {Anchor, Point, Scene, Selection} from '../geometry/model';
import {edgeContext, uid} from '../geometry/model';
import {createPolygon, removePolygon, removeVertex, translatePolygon} from '../geometry/operations';
import {createDemo} from '../geometry/demo';
import {moveAnchor, solveScene} from '../geometry/solver';
import {sceneResiduals} from '../geometry/solver-residuals';
import {magnitude} from '../geometry/solver-numerics';
import {sampleEdge} from '../geometry/curves';
import {hitScene} from '../render/scene';
import {screenPoint, worldPoint} from '../render/raster';
import type {LineAlgorithm, View} from '../render/raster';
import type {RenderSettings} from '../geometry/serialization';

export type Tool = 'edit' | 'draw' | 'move' | 'relation';
type Drag = { readonly base: Scene; readonly selection: Selection; readonly start: Point; moved: boolean };

export function useEditor() {
    const [scene, setScene] = useState<Scene>(createDemo), [selections, setSelections] = useState<readonly Selection[]>([]),
        [tool, changeTool] = useState<Tool>('edit'),
        selected = selections[selections.length - 1] ?? null,
        pair = selections.flatMap(item => item.kind === 'edge' ? [item.edge] : []),
        [draft, setDraft] = useState<readonly Point[]>([]),
        [algorithm, setAlgorithm] = useState<LineAlgorithm>('library'),
        [antialiasing, setAntialiasing] = useState(false),
        [guides, setGuides] = useState(true),
        [view, setView] = useState<View>({scale: 1, x: 0, y: 0}),
        [message, setMessage] = useState('Wybierz element lub przeciągnij punkt.'),
        [residual, setResidual] = useState(0),
        [revision, setRevision] = useState(0),
        past = useRef<Scene[]>([]),
        future = useRef<Scene[]>([]),
        drag = useRef<Drag | null>(null),
        size = useRef<Point>({x: 900, y: 600});
    const initialized = useRef(false);
    const drawing = {scene, selected, pair, view, algorithm, antialiasing, draft, guides};

    function openScene(next: Scene, settings: RenderSettings) {
        record(scene);
        drag.current = null;
        setScene(next);
        setSelections([]);
        setDraft([]);
        changeTool('edit');
        setAlgorithm(settings.algorithm);
        setAntialiasing(settings.antialiasing);
        setGuides(settings.guides);
        setResidual(magnitude(sceneResiduals(next)));
        fit(size.current, next);
        setMessage('Scena wczytana z pliku.');
    }

    function select(next: Selection | null, additive = tool === 'relation') {
        if (next?.kind === 'edge' && additive) extendEdge(next);
        else setSelections(next ? [next] : []);
    }

    function setTool(next: Tool) {
        changeTool(next);
        if (next !== 'relation') setSelections(items => next === 'draw' ? [] : items.slice(-1));
    }

    function extendEdge(hit: Extract<Selection, { readonly kind: 'edge' }>) {
        setSelections(items => {
            const edges = items.filter(item => item.kind === 'edge');
            if (edges.some(item => item.edge === hit.edge)) return edges.filter(item => item.edge !== hit.edge);
            return edges.length === 2 ? [hit] : [...edges, hit];
        });
    }

    function record(base: Scene) {
        past.current.push(base);
        future.current = [];
        setRevision(n => n + 1);
    }

    function apply(next: Scene, solve = true) {
        if (next === scene) return;
        const directResidual = magnitude(sceneResiduals(next));
        const result = solve ? solveScene(next) : {
            scene: next,
            residual: directResidual,
            converged: directResidual < 1e-3
        };
        record(scene);
        setScene(result.scene);
        setResidual(result.residual);
        setSelections(items => items.filter(item => (item.kind !== 'edge' && item.kind !== 'control') || edgeContext(result.scene, item.edge)));
        setMessage(result.converged ? 'Geometria zaktualizowana.' : 'Relacje w konflikcie. Usuń relację lub zmień geometrię.');
    }

    function finishPolygon() {
        if (draft.length < 3) {
            setMessage('Wielokąt wymaga co najmniej 3 wierzchołków.');
            return;
        }
        const polygon = createPolygon(draft, scene.polygons.length);
        apply({
            ...scene,
            polygons: [...scene.polygons, {...polygon, name: `Wielokąt ${scene.polygons.length + 1}`}]
        }, false);
        select({kind: 'polygon', polygon: polygon.id});
        setDraft([]);
        setTool('edit');
    }

    function onDown(point: Point, event: PointerEvent<HTMLDivElement>) {
        const world = worldPoint(point, view);
        if (tool === 'draw') {
            const first = draft[0];
            if (first && draft.length >= 3 && Math.hypot(screenPoint(first, view).x - point.x, screenPoint(first, view).y - point.y) < 12) finishPolygon();
            else {
                setDraft([...draft, world]);
                setMessage('Kliknij kolejne punkty. Enter lub pierwszy punkt zamyka wielokąt.');
            }
            return;
        }
        const hit = hitScene(drawing, point);
        if (tool === 'relation' || event.shiftKey) {
            if (hit?.kind === 'edge') {
                extendEdge(hit);
                setMessage('Wybierz 2 krawędzie, następnie dodaj prostopadłość.');
            } else setMessage('Relacja dotyczy krawędzi. Kliknij środek krawędzi.');
            return;
        }
        if (!hit) {
            select(null);
            return;
        }
        const selection: Selection = tool === 'move' ? {kind: 'polygon', polygon: hit.polygon} : hit;
        select(selection);
        drag.current = {base: scene, selection, start: world, moved: false};
    }

    function onMove(point: Point) {
        const active = drag.current;
        if (!active) return;
        const target = worldPoint(point, view);
        if (!active.moved && Math.hypot(target.x - active.start.x, target.y - active.start.y) < 0.5) return;
        if (!active.moved) {
            record(active.base);
            active.moved = true;
        }
        const selection = active.selection;
        let result: ReturnType<typeof solveScene>;
        switch (selection.kind) {
            case 'vertex':
                result = moveAnchor(active.base, {
                    kind: 'vertex',
                    polygon: selection.polygon,
                    vertex: selection.vertex,
                    point: target
                });
                break;
            case 'control':
                result = moveAnchor(active.base, {
                    kind: 'control',
                    polygon: selection.polygon,
                    edge: selection.edge,
                    control: selection.control,
                    point: target
                });
                break;
            case 'edge':
            case 'polygon': {
                const next = translatePolygon(active.base, selection.polygon, {
                    x: target.x - active.start.x,
                    y: target.y - active.start.y
                });
                const polygon = next.polygons.find(p => p.id === selection.polygon);
                const anchors: Anchor[] = polygon ? polygon.vertices.map(v => ({
                    kind: 'vertex',
                    polygon: polygon.id,
                    vertex: v.id,
                    point: v
                })) : [];
                if (polygon) for (const edge of polygon.edges) if (edge.shape.kind === 'bezier') for (const control of ['c1', 'c2'] as const) anchors.push({
                    kind: 'control',
                    polygon: polygon.id,
                    edge: edge.id,
                    control,
                    point: edge.shape[control]
                });
                result = solveScene(next, anchors);
                break;
            }
        }
        setScene(result.scene);
        setResidual(result.residual);
        setMessage(result.converged ? 'Przeciąganie · relacje zachowane' : 'Punkt podąża za kursorem · relacje w konflikcie');
    }

    function onUp() {
        drag.current = null;
    }

    function fit(nextSize = size.current, nextScene = scene) {
        const points = nextScene.polygons.flatMap(p => [...p.vertices, ...p.edges.flatMap(e => [...sampleEdge(nextScene, e.id, 96), ...(e.shape.kind === 'bezier' ? [e.shape.c1, e.shape.c2] : [])])]);
        if (!points.length) {
            setView({scale: 1, x: 0, y: 0});
            return;
        }
        const minX = Math.min(...points.map(p => p.x)) - 80, maxX = Math.max(...points.map(p => p.x)) + 80;
        const minY = Math.min(...points.map(p => p.y)) - 100, maxY = Math.max(...points.map(p => p.y)) + 100;
        const scale = Math.max(0.1, Math.min(nextSize.x / (maxX - minX), nextSize.y / (maxY - minY), 1.8));
        setView({
            scale,
            x: (nextSize.x - (maxX - minX) * scale) / 2 - minX * scale,
            y: (nextSize.y - (maxY - minY) * scale) / 2 - minY * scale
        });
    }

    function onSize(next: Point) {
        const previous = size.current;
        size.current = next;
        if (!initialized.current || Math.abs(previous.x - next.x) > 50 || Math.abs(previous.y - next.y) > 50) {
            initialized.current = true;
            fit(next);
        }
    }

    function onWheel(event: WheelEvent) {
        if (!(event.currentTarget instanceof HTMLElement)) return;
        const rect = event.currentTarget.getBoundingClientRect(),
            p = {x: event.clientX - rect.left, y: event.clientY - rect.top};
        const world = worldPoint(p, view),
            scale = Math.max(0.1, Math.min(5, view.scale * Math.exp(-event.deltaY * 0.001)));
        setView({scale, x: p.x - world.x * scale, y: p.y - world.y * scale});
    }

    function undo(redo = false) {
        const from = redo ? future.current : past.current, to = redo ? past.current : future.current;
        const previous = from.pop();
        if (!previous) return;
        to.push(scene);
        setScene(previous);
        select(null);
        setResidual(magnitude(sceneResiduals(previous)));
        setRevision(n => n + 1);
    }

    function deleteSelected() {
        if (selected?.kind === 'vertex') {
            apply(removeVertex(scene, selected.vertex));
            select(null);
        } else if (selected?.kind === 'polygon') {
            apply(removePolygon(scene, selected.polygon), false);
            select(null);
        }
    }

    function perpendicular() {
        const a = pair[0], b = pair[1];
        if (!a || !b) return;
        if (scene.constraints.some(c => c.kind === 'perpendicular' && ((c.a === a && c.b === b) || (c.a === b && c.b === a)))) {
            setMessage('Ta relacja już istnieje.');
            return;
        }
        apply({...scene, constraints: [...scene.constraints, {id: uid(), kind: 'perpendicular', a, b}]});
        setTool('edit');
    }

    return {
        scene,
        selected,
        select,
        tool,
        setTool,
        pair,
        draft,
        setDraft,
        algorithm,
        setAlgorithm,
        antialiasing,
        setAntialiasing,
        openScene,
        guides,
        setGuides,
        view,
        message,
        setMessage,
        residual,
        drawing,
        apply,
        onDown,
        onMove,
        onUp,
        onSize,
        onWheel,
        fit,
        finishPolygon,
        undo,
        deleteSelected,
        perpendicular,
        canUndo: revision >= 0 && past.current.length > 0,
        canRedo: future.current.length > 0
    };
}

export type Editor = ReturnType<typeof useEditor>;
