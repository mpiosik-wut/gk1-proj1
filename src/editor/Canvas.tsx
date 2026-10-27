import {useEffect, useEffectEvent, useLayoutEffect, useRef, useState} from 'react';
import type {PointerEvent} from 'react';
import {renderScene} from '../render/scene';
import type {Drawing} from '../render/scene';
import type {createGpuPresenter} from "../render/gpu";
import type {Point} from '../geometry/model';

type Props = {
    readonly drawing: Drawing;
    readonly cursor: string;
    readonly onDown: (point: Point, event: PointerEvent<HTMLDivElement>) => void;
    readonly onMove: (point: Point) => void;
    readonly onUp: () => void;
    readonly onWheel: (event: WheelEvent) => void;
    readonly onSize: (point: Point) => void;
    readonly onBackend: (name: string) => void
};

export function Canvas(props: Props) {
    const container = useRef<HTMLDivElement>(null),
        raster = useRef<HTMLCanvasElement>(null),
        gpu = useRef<HTMLCanvasElement>(null),
        presenter = useRef<Awaited<ReturnType<typeof createGpuPresenter>>>(undefined),
        [size, setSize] = useState({x: 0, y: 0}),
        [gpuReady, setGpuReady] = useState(false),
        onSize = useEffectEvent<Props['onSize']>((...args) => props.onSize(...args)),
        onBackend = useEffectEvent<Props['onBackend']>((...args) => props.onBackend(...args)),
        onWheel = useEffectEvent<Props['onWheel']>((...args) => props.onWheel(...args));


    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            event.stopPropagation();
            onWheel(event);
        };
        element.addEventListener('wheel', wheel, {passive: false});
        return () => element.removeEventListener('wheel', wheel);
    }, []);

    useLayoutEffect(() => {
        const element = container.current;
        if (!element) return;
        const observer = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect;
            if (!rect) return;
            const next = {x: rect.width, y: rect.height};
            setSize(next);
            onSize(next);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let disposed = false;
        const canvas = gpu.current;
        if (!canvas) return;
        import('../render/gpu').then(module => module.createGpuPresenter(canvas)).then(value => {
            if (disposed) {
                value?.destroy();
                return;
            }
            presenter.current = value;
            setGpuReady(Boolean(value));
            onBackend(value ? 'WebGPU · TypeGPU' : 'Canvas 2D · brak WebGPU');
            if (value) void value.lost.then(() => {
                if (!disposed) {
                    setGpuReady(false);
                    onBackend('Canvas 2D · GPU niedostępne');
                }
            });
        }).catch((error: unknown) => {
            if (error instanceof Error && !disposed) {
                onBackend('Canvas 2D · WebGPU niedostępne');
                setGpuReady(false);
            } else if (!(error instanceof Error)) throw error;
        });
        return () => {
            disposed = true;
            presenter.current?.destroy();
            presenter.current = undefined;
        };
    }, []);

    useLayoutEffect(() => {
        const source = raster.current, target = gpu.current;
        if (!source || !target || size.x <= 0 || size.y <= 0) return;
        const dpr = window.devicePixelRatio || 1;
        source.width = target.width = Math.round(size.x * dpr);
        source.height = target.height = Math.round(size.y * dpr);
        const context = source.getContext('2d');
        if (!context) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderScene(context, props.drawing);
        if (gpuReady) presenter.current?.present(source);
    }, [size, props.drawing, gpuReady]);

    function point(event: PointerEvent<HTMLDivElement>): Point {
        const rect = event.currentTarget.getBoundingClientRect();
        return {x: event.clientX - rect.left, y: event.clientY - rect.top};
    }

    return <div ref={container} className="canvas-surface" style={{cursor: props.cursor}} role="application"
                aria-label="Scena wielokątów. Instrukcja obsługi w przycisku Pomoc." tabIndex={0}
                onPointerDown={event => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    props.onDown(point(event), event);
                }}
                onPointerMove={event => props.onMove(point(event))} onPointerUp={props.onUp}
                onPointerCancel={props.onUp} onLostPointerCapture={props.onUp}>
        <canvas ref={raster} className="scene-canvas" style={{opacity: gpuReady ? 0 : 1}}/>
        <canvas ref={gpu} className="scene-canvas gpu-canvas" style={{opacity: gpuReady ? 1 : 0}}/>
    </div>;
}
