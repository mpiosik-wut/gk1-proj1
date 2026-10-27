import {z} from 'zod';
import {
    TrashIcon as Trash,
    PlusIcon as Plus,
    ArrowRightIcon as ArrowRight,
    ArrowBendDownRightIcon as ArrowBendDownRight
} from '@phosphor-icons/react';
import type {Editor} from './useEditor';
import {edgeContext, MAX_EDGE_WIDTH, MIN_EDGE_WIDTH} from '../geometry/model';
import type {Point} from '../geometry/model';
import {addVertex, setContinuity, setEdgeKind, setEdgeWidth} from '../geometry/operations';
import {moveAnchor} from '../geometry/solver';

const positionSchema = z.object({
    x: z.number().min(-10000).max(10000),
    y: z.number().min(-10000).max(10000)
});

function PositionForm({point, onPoint}: { readonly point: Point; readonly onPoint: (p: Point) => void }) {
    return <form key={`${point.x},${point.y}`} className="position-form" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = positionSchema.safeParse({x: Number(data.get('x')), y: Number(data.get('y'))});
        if (value.success) onPoint(value.data);
    }}>
        <label>X <input name="x" type="number" step="any" required min="-10000" max="10000"
                        defaultValue={Number(point.x.toFixed(2))}/></label>
        <label>Y <input name="y" type="number" step="any" required min="-10000" max="10000"
                        defaultValue={Number(point.y.toFixed(2))}/></label>
        <button title="Zastosuj pozycję" aria-label="Zastosuj pozycję" type="submit"><ArrowRight size={16}/></button>
    </form>;
}

export function Inspector({editor: e, onLength}: {
    readonly editor: Editor;
    readonly onLength: (edge: string) => void
}) {
    const selected = e.selected;
    const polygon = e.scene.polygons.find(p => p.id === selected?.polygon);
    const edge = selected?.kind === 'edge' || selected?.kind === 'control' ? edgeContext(e.scene, selected.edge) : undefined;
    const vertex = selected?.kind === 'vertex' ? polygon?.vertices.find(v => v.id === selected.vertex) : undefined;
    const edgeName = (id: string) => {
        const ctx = edgeContext(e.scene, id);
        return ctx ? `${ctx.polygon.name} / ${ctx.polygon.edges.findIndex(x => x.id === id) + 1}` : '?';
    };
    return <aside className="inspector" aria-label="Właściwości geometrii">
        {e.pair.length !== 2 && <section>
            <div className="section-heading"><h2>Właściwości</h2></div>
            {!selected &&
                <div className="empty-inspector"><ArrowBendDownRight size={28} weight="light"/><p>Wybierz coś na
                    scenie</p><span>Wierzchołek, krawędź lub wnętrze wielokąta.</span></div>}
            {polygon &&
                <p className="selection-name">{polygon.name}<span>{vertex ? `Wierzchołek ${polygon.vertices.findIndex(v => v.id === vertex.id) + 1}` : edge ? `Krawędź ${polygon.edges.findIndex(x => x.id === edge.edge.id) + 1}` : 'Cały wielokąt'}</span>
                </p>}
            {vertex && selected?.kind === 'vertex' && <>
                <PositionForm point={vertex} onPoint={point => e.apply(moveAnchor(e.scene, {
                    kind: 'vertex',
                    polygon: polygon?.id ?? '',
                    vertex: vertex.id,
                    point
                }).scene, false)}/>
                {polygon?.edges.some(x => (x.from === vertex.id || x.to === vertex.id) && x.shape.kind !== 'line') && <>
                    <label className="field-label">Ciągłość w wierzchołku</label>
                    <div className="segmented">
                        {(['G0', 'G1', 'C1'] as const).map(c =>
                            <button key={c}
                                    aria-pressed={vertex.continuity === c}
                                    disabled={c === 'C1' && polygon.edges.some(
                                        x => x.shape.kind === 'arc' && (x.from === vertex.id || x.to === vertex.id)
                                    )}
                                    onClick={() => e.apply(setContinuity(e.scene, vertex.id, c))}>{c}</button>
                        )}
                    </div>
                    <p className="hint">{vertex.continuity === 'C1' ? 'Równe wektory styczne.' : vertex.continuity === 'G1' ? 'Ten sam kierunek stycznych.' : 'Wspólne położenie końców.'}</p>
                </>}
                <button className="danger full" disabled={(polygon?.vertices.length ?? 0) <= 3}
                        onClick={e.deleteSelected}><Trash size={16}/> Usuń wierzchołek
                </button>
                {(polygon?.vertices.length ?? 0) <= 3 &&
                    <p className="hint">Wielokąt musi mieć minimum 3 wierzchołki.</p>}
            </>}
            {edge && <>
                <form key={`${edge.edge.id}:${edge.edge.width}`} onSubmit={event => {
                    event.preventDefault();
                    const width = Number(new FormData(event.currentTarget).get('width'));
                    e.apply(setEdgeWidth(e.scene, edge.edge.id, width), false);
                }}>
                    <label className="field-label" htmlFor="edge-width">Grubość krawędzi (px)</label>
                    <div className="width-form">
                        <input id="edge-width" name="width" type="number" min={MIN_EDGE_WIDTH} max={MAX_EDGE_WIDTH}
                               step="any" required defaultValue={edge.edge.width}/>
                        <button type="submit" title="Zastosuj grubość" aria-label="Zastosuj grubość"><ArrowRight size={16}/></button>
                    </div>
                </form>
                <label className="field-label">Typ krawędzi</label>
                <div className="segmented">{([{kind: 'line', label: 'Odcinek'}, {
                    kind: 'bezier',
                    label: 'Bézier'
                }, {kind: 'arc', label: 'Łuk'}] as const).map(t => <button key={t.kind}
                                                                           aria-pressed={edge.edge.shape.kind === t.kind}
                                                                           onClick={() => e.apply(setEdgeKind(e.scene, edge.edge.id, t.kind))}>{t.label}</button>)}</div>
                <div className="measurement">
                    <span>Długość cięciwy</span><strong>{Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y).toFixed(2)}
                    <small>px</small></strong></div>
                {selected?.kind === 'control' && edge.edge.shape.kind === 'bezier' && <>
                    <label className="field-label">Punkt kontrolny {selected.control === 'c1' ? '1' : '2'}</label>
                    <PositionForm point={edge.edge.shape[selected.control]}
                                  onPoint={point => e.apply(moveAnchor(e.scene, {
                                      kind: 'control',
                                      polygon: edge.polygon.id,
                                      edge: edge.edge.id,
                                      control: selected.control,
                                      point
                                  }).scene, false)}/>
                </>}
                {edge.edge.shape.kind === 'arc' &&
                    <button className="full" disabled={edge.from.continuity === 'G1' || edge.to.continuity === 'G1'}
                            title="Przy G1 stronę łuku określa styczna" onClick={() => {
                        const shape = edge.edge.shape;
                        if (shape.kind !== 'arc') return;
                        e.apply({
                            ...e.scene,
                            polygons: e.scene.polygons.map(p => p.id === edge.polygon.id ? {
                                ...p,
                                edges: p.edges.map(x => x.id === edge.edge.id ? {
                                    ...x,
                                    shape: {...shape, flip: !shape.flip}
                                } : x)
                            } : p)
                        });
                    }}>Odwróć stronę łuku</button>}
                <button className="full" onClick={() => onLength(edge.edge.id)}>Ustaw długość…</button>
                <button className="full" onClick={() => {
                    e.apply(addVertex(e.scene, edge.edge.id));
                    e.select(null);
                }}><Plus size={16}/> Dodaj środkowy wierzchołek
                </button>
                <p className="hint">Podział usuwa relacje tej krawędzi.</p>
            </>}
            {selected?.kind === 'polygon' && <><p className="hint">Przeciągnij wnętrze, aby przesunąć cały wielokąt.</p>
                <button className="danger full" onClick={e.deleteSelected}><Trash size={16}/> Usuń wielokąt</button>
            </>}
        </section>}
        <section>
            <div className="section-heading"><h2>Relacje</h2><span className="count">{e.scene.constraints.length}</span>
            </div>
            <p className="hint">Wybierz parę krawędzi narzędziem relacji lub z klawiszem Shift.</p>
            {e.pair.length > 0 && <p className="pair-summary">Wybrano {e.pair.length}/2 krawędzie</p>}
            <button className="full" disabled={e.pair.length !== 2} onClick={e.perpendicular}>⊥ Dodaj prostopadłość
            </button>
            <div className="relation-list">{e.scene.constraints.map(c => <div className="relation-row" key={c.id}>
                <span className="relation-glyph">{c.kind === 'length' ? '↔' : '⊥'}</span>
                <div>
                    <strong>{c.kind === 'length' ? `${c.value.toFixed(2)} px` : 'Prostopadłość'}</strong><small>{c.kind === 'length' ? edgeName(c.edge) : `${edgeName(c.a)} ↔ ${edgeName(c.b)}`}</small>
                </div>
                <button className="icon-button" title="Usuń relację"
                        aria-label={`Usuń relację ${c.kind === 'length' ? c.value.toFixed(2) + ' px' : 'prostopadłości'}`}
                        onClick={() => e.apply({
                            ...e.scene,
                            constraints: e.scene.constraints.filter(x => x.id !== c.id)
                        }, false)}><Trash size={14}/></button>
            </div>)}</div>
            {e.residual > 0.001 &&
                <p className="error" role="alert">Relacje nie są spełnione. Błąd: {e.residual.toFixed(3)}. Zmień
                    położenie lub usuń relację.</p>}
        </section>
        <section>
            <div className="section-heading"><h2>Scena</h2><span className="count">{e.scene.polygons.length}</span>
            </div>
            {e.scene.polygons.map(p => <details key={p.id} open={p.id === polygon?.id}>
                <summary>{p.name}<span>{p.vertices.length} pkt</span></summary>
                <div className="structure-buttons">
                    <button onClick={() => e.select({kind: 'polygon', polygon: p.id})}>Całość</button>
                    {p.vertices.map((v, i) =>
                        <button key={v.id} title={`Wierzchołek ${i + 1}`}
                                onClick={() => e.select({
                                    kind: 'vertex',
                                    polygon: p.id,
                                    vertex: v.id
                                })}>V{i + 1}</button>)}
                    {p.edges.map((x, i) =>
                        <button key={x.id}
                                title={`Krawędź ${i + 1}`}
                                onClick={event => e.select({
                                    kind: 'edge',
                                    polygon: p.id,
                                    edge: x.id
                                }, event.shiftKey || e.tool === 'relation')}>E{i + 1}</button>)}
                </div>
            </details>)}
            {e.scene.polygons.length === 0 &&
                <p className="hint">Pusta scena. Wybierz „Nowy wielokąt” i kliknij minimum 3 punkty.</p>}
        </section>
        <section>
            <h2>Rysowanie odcinków</h2>
            <fieldset className="radio-group">
                <legend className="sr-only">Algorytm rysowania</legend>
                <label><input type="radio" name="algorithm" checked={e.algorithm === 'library'}
                              onChange={() => e.setAlgorithm('library')}/> Biblioteczny <small>Canvas 2D</small></label>
                <label><input type="radio" name="algorithm" checked={e.algorithm === 'bresenham'}
                              onChange={() => e.setAlgorithm('bresenham')}/> Bresenham <small>własny</small></label>
            </fieldset>
            <label className="checkbox-label"><input type="checkbox" checked={e.antialiasing}
                                                     onChange={event => e.setAntialiasing(event.target.checked)}/> Antialiasing Wu</label>
            <p className="hint">Wygładzanie odcinków i łuków. Bézier korzysta z wybranego algorytmu.</p>
            <label className="checkbox-label"><input type="checkbox" checked={e.guides}
                                                     onChange={event => e.setGuides(event.target.checked)}/> Wielobok i
                punkty Béziera</label>
        </section>
    </aside>;
}
