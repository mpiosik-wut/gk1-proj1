import {useEffect, useEffectEvent, useRef, useState} from 'react';
import {
    CursorIcon,
    PolygonIcon,
    ArrowsOutCardinalIcon,
    LinkIcon,
    ArrowCounterClockwiseIcon,
    ArrowClockwiseIcon,
    CornersOutIcon,
    QuestionIcon,
    XIcon,
    DownloadSimpleIcon,
    FolderOpenIcon
} from '@phosphor-icons/react';
import {z} from 'zod';
import {Canvas} from './editor/Canvas';
import {Inspector} from './editor/Inspector';
import {FileName} from './editor/FileName';
import {useEditor} from './editor/useEditor';
import type {Tool} from './editor/useEditor';
import {edgeContext, uid} from './geometry/model';
import {Help} from './Help';
import {DEFAULT_FILE_NAME, MAX_FILE_SIZE, normalizeFileName, parseScene, serializeScene} from './geometry/serialization';

const lengthSchema = z.number().positive().max(20000);
const tools = [
    {id: 'edit', label: 'Edycja', key: 'E', icon: CursorIcon},
    {id: 'draw', label: 'Nowy wielokąt', key: 'N', icon: PolygonIcon},
    {id: 'move', label: 'Przesuwanie', key: 'M', icon: ArrowsOutCardinalIcon},
    {id: 'relation', label: 'Relacje', key: 'R', icon: LinkIcon},
] as const;

export function App() {
    const editor = useEditor(),
        [backend, setBackend] = useState('Uruchamianie renderera…'),
        [modal, setModal] = useState<'help' | 'length' | null>(null), [lengthEdge, setLengthEdge] = useState<string | null>(null), [lengthError, setLengthError] = useState(''),
        dialog = useRef<HTMLDialogElement>(null),
        fileInput = useRef<HTMLInputElement>(null),
        [opening, setOpening] = useState(false),
        [fileName, setFileName] = useState(DEFAULT_FILE_NAME),
        edge = lengthEdge ? edgeContext(editor.scene, lengthEdge) : undefined;

    useEffect(() => {
        if (modal && !dialog.current?.open) dialog.current?.showModal(); else if (!modal) dialog.current?.close();
    }, [modal]);

    const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
        if (dialog.current?.open || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
        if (event.metaKey || event.ctrlKey) {
            if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                editor.undo(event.shiftKey);
            }
            return;
        }
        switch (event.key.toLowerCase()) {
            case 'e':
                editor.setTool('edit');
                break;
            case 'n':
                editor.setTool('draw');
                break;
            case 'm':
                editor.setTool('move');
                break;
            case 'r':
                editor.setTool('relation');
                break;
            case 'f':
                editor.fit();
                break;
            case 'enter':
                if (editor.tool === 'draw') {
                    event.preventDefault();
                    editor.finishPolygon();
                }
                break;
            case 'escape':
                editor.setDraft([]);
                editor.select(null);
                editor.setTool('edit');
                break;
            case 'delete':
            case 'backspace':
                event.preventDefault();
                editor.deleteSelected();
                break;
        }
    });

    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    function chooseTool(tool: Tool) {
        editor.setTool(tool);
        if (tool !== 'draw') editor.setDraft([]);
        editor.setMessage(tool === 'draw' ? 'Kliknij minimum 3 punkty. Enter zamyka wielokąt.' : tool === 'relation' ? 'Kliknij 2 krawędzie, by dodać prostopadłość.' : 'Wybierz element lub przeciągnij punkt.');
    }

    return <div className="app-shell">
        <header className="app-header">
            <div className="brand"><PolygonIcon size={26} weight="duotone"/><h1>Polygon <span>Studio</span></h1><span
                className="brand-divider"/><FileName name={fileName} onChange={setFileName}/></div>
            <div className="header-actions">
                <input ref={fileInput} className="sr-only" type="file" accept=".json,application/json" aria-label="Otwórz plik sceny"
                       disabled={opening} onChange={async event => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (!file) return;
                    setOpening(true);
                    try {
                        if (file.size > MAX_FILE_SIZE) throw new Error('Plik jest zbyt duży. Maksymalny rozmiar to 5 MB.');
                        const document = parseScene(await file.text());
                        editor.openScene(document.scene, document.settings);
                        setFileName(document.name ?? normalizeFileName(file.name));
                    } catch (error) {
                        window.alert(error instanceof Error ? error.message : 'Nie udało się otworzyć pliku.');
                    } finally {
                        setOpening(false);
                    }
                }}/>
                <button disabled={opening} onClick={() => fileInput.current?.click()}><FolderOpenIcon size={18}/><span>{opening ? 'Wczytywanie…' : 'Otwórz'}</span></button>
                <button onClick={() => {
                    const blob = new Blob([serializeScene(editor.scene, editor, fileName)], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${fileName}.json`;
                    document.body.append(anchor);
                    anchor.click();
                    anchor.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    editor.setMessage('Wyeksportowano scenę do pliku JSON.');
                }}><DownloadSimpleIcon size={18}/><span>Eksportuj</span></button>
                <button onClick={() => setModal('help')}><QuestionIcon size={18}/> Pomoc</button>
            </div>
        </header>
        <main className="workspace">
            <div className="canvas-area">
                <div className="toolbar" aria-label="Narzędzia edytora">
                    <div className="tool-group">{tools.map(t => <button key={t.id} aria-pressed={editor.tool === t.id}
                                                                        title={`${t.label} (${t.key})`}
                                                                        onClick={() => chooseTool(t.id)}>
                        <t.icon size={18}/>
                        <span>{t.label}</span><kbd>{t.key}</kbd></button>)}</div>
                    <div className="tool-group history-tools">
                        <button className="icon-button" title="Cofnij (Ctrl/Cmd+Z)" aria-label="Cofnij"
                                disabled={!editor.canUndo} onClick={() => editor.undo()}><ArrowCounterClockwiseIcon
                            size={18}/></button>
                        <button className="icon-button" title="Ponów (Ctrl/Cmd+Shift+Z)" aria-label="Ponów"
                                disabled={!editor.canRedo} onClick={() => editor.undo(true)}><ArrowClockwiseIcon
                            size={18}/></button>
                    </div>
                </div>
                <Canvas drawing={editor.drawing}
                        cursor={editor.tool === 'draw' ? 'crosshair' : editor.tool === 'move' ? 'move' : 'default'}
                        onDown={editor.onDown} onMove={editor.onMove} onUp={editor.onUp} onWheel={editor.onWheel}
                        onSize={editor.onSize} onBackend={setBackend}/>
                <div className="canvas-footer">
                    <span>{editor.tool === 'draw' ? `${editor.draft.length} punktów · Enter zamyka · Esc anuluje` : 'Przeciągnij punkty · Shift wybiera parę krawędzi'}</span>
                    <button onClick={() => editor.fit()} title="Dopasuj widok (F)"><CornersOutIcon
                        size={16}/> {Math.round(editor.view.scale * 100)}%
                    </button>
                </div>
                {editor.tool === 'draw' && editor.draft.length >= 3 &&
                    <button className="finish-draft" onClick={editor.finishPolygon}>Zamknij wielokąt <kbd>Enter</kbd>
                    </button>}
            </div>
            <Inspector editor={editor} onLength={id => {
                setLengthEdge(id);
                setLengthError('');
                setModal('length');
            }}/>
        </main>
        <footer className="status-bar"><span className={editor.residual > 0.001 ? 'error' : ''}
                                             role="status">{editor.message}</span><span>{backend}</span></footer>
        <dialog ref={dialog} onClose={() => setModal(null)}
                className={modal === 'help' ? 'help-dialog' : 'length-dialog'}>
            <div className="dialog-heading">
                <h2>{modal === 'help' ? 'Jak działa Polygon Studio' : 'Długość krawędzi'}</h2>
                <button className="icon-button" aria-label="Zamknij okno" onClick={() => setModal(null)}><XIcon
                    size={20}/></button>
            </div>
            {modal === 'help' && <Help/>}
            {modal === 'length' && edge && <form key={edge.edge.id} onSubmit={event => {
                event.preventDefault();
                const input = new FormData(event.currentTarget).get('length');
                const value = lengthSchema.safeParse(Number(input));
                if (!value.success) {
                    setLengthError('Podaj dodatnią długość do 20 000 px.');
                    return;
                }
                const existing = editor.scene.constraints.find(c => c.kind === 'length' && c.edge === edge.edge.id);
                editor.apply({
                    ...editor.scene,
                    constraints: [...editor.scene.constraints.filter(c => c.id !== existing?.id), {
                        kind: 'length',
                        id: existing?.id ?? uid(),
                        edge: edge.edge.id,
                        value: value.data
                    }]
                });
                setModal(null);
            }}>
                <p className="hint">
                    Długość cięciwy między końcami krawędzi. Relacja pozostanie aktywna podczas edycji.
                </p>
                <label className="field-label" htmlFor="length-value">Długość (px)</label>
                <input id="length-value"
                       name="length"
                       type="number"
                       step="any" min="0.01"
                       max="20000" required
                       autoFocus
                       defaultValue={Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y).toFixed(2)}/>
                {lengthError && <p className="error" role="alert">{lengthError}</p>}
                <div className="dialog-actions">
                    <button type="button" onClick={() => setModal(null)}>Anuluj</button>
                    <button className="primary" type="submit">Zastosuj długość</button>
                </div>
            </form>}
        </dialog>
    </div>;
}
