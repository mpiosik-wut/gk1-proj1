import type {Point} from '../geometry/model';

export type View = { readonly scale: number; readonly x: number; readonly y: number };
export type LineAlgorithm = 'library' | 'bresenham';
export const screenPoint = (point: Point, view: View): Point => ({
    x: point.x * view.scale + view.x,
    y: point.y * view.scale + view.y
});
export const worldPoint = (point: Point, view: View): Point => ({
    x: (point.x - view.x) / view.scale,
    y: (point.y - view.y) / view.scale
});

// Integer, all-octant Bresenham; clipping happens BEFORE rasterization to bound work.
export function bresenham(context: CanvasRenderingContext2D, a: Point, b: Point) {
    let x = Math.round(a.x), y = Math.round(a.y);
    const x2 = Math.round(b.x), y2 = Math.round(b.y);
    const dx = Math.abs(x2 - x), dy = -Math.abs(y2 - y);
    const sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
    const width = Math.max(1, Math.round(context.lineWidth)), offset = Math.floor(width / 2);
    let error = dx + dy;
    for (; ;) {
        context.fillRect(x - offset, y - offset, width, width);
        if (x === x2 && y === y2) break;
        const twice = 2 * error;
        if (twice >= dy) {
            error += dy;
            x += sx;
        }
        if (twice <= dx) {
            error += dx;
            y += sy;
        }
    }
}

// Liang–Barsky clipping makes even very large off-canvas geometry safe to draw.
function clip(a: Point, b: Point, bounds: Point, padding = 0): readonly [Point, Point] | undefined {
    const dx = b.x - a.x, dy = b.y - a.y;
    let lo = 0, hi = 1;
    const planes = [[-dx, a.x + padding], [dx, bounds.x + padding - a.x], [-dy, a.y + padding], [dy, bounds.y + padding - a.y]];
    for (const plane of planes) {
        const p = plane[0], q = plane[1];
        if (p === undefined || q === undefined) continue;
        if (p === 0) {
            if (q < 0) return undefined;
            continue;
        }
        const ratio = q / p;
        if (p < 0) lo = Math.max(lo, ratio); else hi = Math.min(hi, ratio);
        if (lo > hi) return undefined;
    }
    return [{x: a.x + lo * dx, y: a.y + lo * dy}, {x: a.x + hi * dx, y: a.y + hi * dy}];
}

// Xiaolin Wu: interpolate coverage between neighbouring pixels along the minor axis.
// A wider band fills the interior and applies the same coverage rule at its borders.
// Merge samples before compositing so adjacent arc segments cannot darken their joins.
export function wuPolyline(context: CanvasRenderingContext2D, points: readonly Point[]) {
    const bounds = {x: context.canvas.width, y: context.canvas.height};
    const coverage = new Map<number, number>();
    const plot = (x: number, y: number, alpha: number) => {
        if (x < 0 || y < 0 || x >= bounds.x || y >= bounds.y || alpha <= 0) return;
        const key = y * bounds.x + x;
        coverage.set(key, Math.max(coverage.get(key) ?? 0, Math.min(1, alpha)));
    };
    const roundJoin = (point: Point) => {
        const radius = context.lineWidth / 2;
        for (let y = Math.max(0, Math.floor(point.y - radius - 1)); y <= Math.min(bounds.y - 1, Math.ceil(point.y + radius + 1)); y++) {
            for (let x = Math.max(0, Math.floor(point.x - radius - 1)); x <= Math.min(bounds.x - 1, Math.ceil(point.x + radius + 1)); x++) {
                plot(x, y, radius + 0.5 - Math.hypot(x - point.x, y - point.y));
            }
        }
    };
    const fraction = (value: number) => value - Math.floor(value);
    for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i], b = points[i + 1];
        if (!a || !b) continue;
        const segment = clip(a, b, bounds, context.lineWidth / 2 + 2);
        if (!segment) continue;
        const steep = Math.abs(segment[1].y - segment[0].y) > Math.abs(segment[1].x - segment[0].x);
        let start = steep ? {x: segment[0].y, y: segment[0].x} : segment[0];
        let end = steep ? {x: segment[1].y, y: segment[1].x} : segment[1];
        let firstEndpoint = i === 0, lastEndpoint = i === points.length - 2;
        if (start.x > end.x) {
            [start, end] = [end, start];
            [firstEndpoint, lastEndpoint] = [lastEndpoint, firstEndpoint];
        }
        const dx = end.x - start.x;
        if (dx === 0) {
            roundJoin(segment[0]);
            continue;
        }
        const gradient = (end.y - start.y) / dx;
        const halfBand = Math.max(0, (context.lineWidth - 1) * Math.hypot(1, gradient) / 2);
        const first = Math.round(start.x), last = Math.round(end.x);
        const majorLimit = steep ? bounds.y : bounds.x, minorLimit = steep ? bounds.x : bounds.y;
        for (let x = Math.max(0, first); x <= Math.min(majorLimit - 1, last); x++) {
            const center = start.y + gradient * (x - start.x);
            const upper = center - halfBand, lower = center + halfBand;
            let gap = 1;
            if (first === last && firstEndpoint && lastEndpoint) gap = Math.min(1, dx);
            else {
                if (x === first && firstEndpoint) gap *= 1 - fraction(start.x + 0.5);
                if (x === last && lastEndpoint) gap *= fraction(end.x + 0.5);
            }
            for (let y = Math.max(0, Math.floor(upper)); y <= Math.min(minorLimit - 1, Math.ceil(lower)); y++) {
                const alpha = Math.min(1, y - upper + 1, lower - y + 1) * gap;
                if (steep) plot(y, x, alpha); else plot(x, y, alpha);
            }
        }
    }
    // A thick segment's minor-axis band ends at its endpoint's major coordinate.
    // At a change of axis, these ends leave a wedge missing from the outside of
    // an arc. Round joins cover that wedge and match Canvas's round lineJoin.
    // Include them in the same coverage mask to avoid double alpha blending.
    if (context.lineWidth > 1) {
        for (let i = 1; i + 1 < points.length; i++) {
            const point = points[i];
            if (point) roundJoin(point);
        }
    }
    const alpha = context.globalAlpha;
    for (const [key, value] of coverage) {
        context.globalAlpha = alpha * value;
        context.fillRect(key % bounds.x, Math.floor(key / bounds.x), 1, 1);
    }
    context.globalAlpha = alpha;
}

export function drawPolyline(context: CanvasRenderingContext2D, points: readonly Point[], algorithm: LineAlgorithm, antialiasing = false) {
    if (algorithm === 'library' && !antialiasing) {
        context.beginPath();
        points.forEach((point, i) => i === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
        context.stroke();
        return;
    }
    // Rasterize in physical pixels, including on HiDPI screens. Canvas transforms
    // would otherwise stretch each integer pixel into a blurry device-pixel block.
    const transform = context.getTransform();
    const pixels = points.map(point => ({
        x: transform.a * point.x + transform.c * point.y + transform.e,
        y: transform.b * point.x + transform.d * point.y + transform.f
    }));
    context.save();
    context.resetTransform();
    context.lineWidth *= Math.hypot(transform.a, transform.b);
    try {
        if (antialiasing) {
            wuPolyline(context, pixels);
            return;
        }
        pixels.forEach((point, i) => {
            const next = pixels[i + 1];
            if (!next) return;
            const segment = clip(point, next, {x: context.canvas.width, y: context.canvas.height}, context.lineWidth / 2 + 1);
            if (segment) bresenham(context, segment[0], segment[1]);
        });
    } finally {
        context.restore();
    }
}
