/** Unknown quantities remain unknown through aggregation and shared-edge comparisons. */
export function sumBomQuantities(values: readonly (number|null)[]): number|null {
 if (values.some(value => value === null)) return null;
 const sum = values.reduce<number>((total,value) => total + value!, 0);
 if (!Number.isFinite(sum)) throw new Error('BOM 수량 합계를 확인하세요.');
 return sum;
}
export function sameBomQuantity(a:number|null,b:number|null):boolean {
 return a === null || b === null ? a === b : Math.abs(a-b) < 1e-9;
}
