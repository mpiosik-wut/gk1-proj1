export const magnitude = (values: readonly number[]): number => Math.hypot(...values);

function dualStep(jacobian: readonly (readonly number[])[], residual: readonly number[], damping: number): readonly number[] {
    const size = residual.length;
    const matrix = jacobian.map((row, index) => jacobian.map((other, column) =>
        row.reduce((sum, value, position) => sum + value * (other[position] ?? 0), 0) + (index === column ? damping : 0)));
    const rhs = residual.map(value => -value);
    for (let pivot = 0; pivot < size; pivot++) {
        const row = matrix[pivot];
        if (!row) continue;
        for (let column = 0; column <= pivot; column++) {
            const other = matrix[column];
            if (!other) continue;
            let value = row[column] ?? 0;
            for (let inner = 0; inner < column; inner++) value -= (row[inner] ?? 0) * (other[inner] ?? 0);
            row[column] = column === pivot ? Math.sqrt(Math.max(value, 1e-20)) : value / (other[column] ?? 1);
        }
    }
    const solution = Array<number>(size).fill(0);
    for (let index = 0; index < size; index++) {
        const row = matrix[index];
        if (!row) continue;
        let value = rhs[index] ?? 0;
        for (let column = 0; column < index; column++) value -= (row[column] ?? 0) * (solution[column] ?? 0);
        solution[index] = value / (row[index] ?? 1);
    }
    for (let index = size - 1; index >= 0; index--) {
        let value = solution[index] ?? 0;
        for (let column = index + 1; column < size; column++) value -= (matrix[column]?.[index] ?? 0) * (solution[column] ?? 0);
        solution[index] = value / (matrix[index]?.[index] ?? 1);
    }
    return (jacobian[0] ?? []).map((_, column) => jacobian.reduce((sum, row, index) => sum + (row[column] ?? 0) * (solution[index] ?? 0), 0));
}

export function minimize(initial: readonly number[], evaluate: (values: readonly number[]) => readonly number[]): readonly number[] {
    let values = [...initial];
    let residual = evaluate(values);
    let damping = 1e-5;
    for (let iteration = 0; iteration < 40 && magnitude(residual) > 1e-5; iteration++) {
        const columns = values.map((value, index) => {
            const step = 1e-4 * Math.max(1, Math.abs(value) / 100);
            const plus = evaluate(values.map((current, position) => position === index ? current + step : current));
            const minus = evaluate(values.map((current, position) => position === index ? current - step : current));
            return plus.map((current, row) => (current - (minus[row] ?? current)) / (2 * step));
        });
        const jacobian = residual.map((_, row) => columns.map(column => column[row] ?? 0));
        const delta = dualStep(jacobian, residual, damping);
        let accepted = false;
        for (let attempt = 0; attempt < 12; attempt++) {
            const scale = 2 ** -attempt;
            const candidate = values.map((value, index) => value + scale * (delta[index] ?? 0));
            if (!candidate.every(Number.isFinite)) continue;
            const next = evaluate(candidate);
            if (magnitude(next) < magnitude(residual)) {
                values = candidate;
                residual = next;
                accepted = true;
                damping = Math.max(1e-9, damping / 3);
                break;
            }
        }
        if (!accepted) {
            let bestValues = values;
            let bestResidual = residual;
            for (let index = 0; index < values.length; index++) {
                for (const offset of [-1, 1]) {
                    const candidate = values.map((value, position) => position === index ? value + offset : value);
                    const next = evaluate(candidate);
                    if (magnitude(next) < magnitude(bestResidual)) {
                        bestValues = candidate;
                        bestResidual = next;
                    }
                }
            }
            values = bestValues;
            residual = bestResidual;
            damping *= 10;
        }
        if (damping > 1e8) break;
    }
    return values;
}
