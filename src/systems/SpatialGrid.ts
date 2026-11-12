/** Простая равномерная сетка для быстрых запросов «кто рядом». Перестраивается каждый кадр. */
export class SpatialGrid<T extends { x: number; y: number }> {
  private cells = new Map<number, T[]>();
  private used: T[][] = [];

  constructor(private readonly size: number) {}

  private key(cx: number, cy: number): number {
    return ((cx + 0x8000) << 16) | ((cy + 0x8000) & 0xffff);
  }

  clear(): void {
    for (const arr of this.used) arr.length = 0;
    this.used.length = 0;
    if (this.cells.size > 4096) this.cells.clear();
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.size), Math.floor(item.y / this.size));
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    if (arr.length === 0) this.used.push(arr);
    arr.push(item);
  }

  /** Все объекты из клеток, пересекающих квадрат вокруг (x, y) радиуса r. Фильтрацию по дистанции делает вызывающий. */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const s = this.size;
    const cx0 = Math.floor((x - r) / s), cx1 = Math.floor((x + r) / s);
    const cy0 = Math.floor((y - r) / s), cy1 = Math.floor((y + r) / s);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }
}
