/** Loading skeleton overlay. */

import type { MalkomTableTheme } from '../types.js';
import { el } from './dom.js';

const CELL_WIDTHS = ['8%', '16%', '8%', '25%', '16%', '8%', '16%'];

export class SkeletonOverlay {
  private visible = false;

  constructor(
    private readonly doc: Document,
    private readonly overlay: HTMLElement,
    private readonly theme: MalkomTableTheme,
    private readonly rows: number
  ) {
    this.overlay.style.display = 'none';
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.overlay.innerHTML = '';
    for (let i = 0; i < this.rows; i++) {
      const row = el(this.doc, 'div', { className: this.theme.skeleton.row });
      for (const width of CELL_WIDTHS) {
        const cell = el(this.doc, 'div', { className: this.theme.skeleton.cell });
        cell.style.width = width;
        row.appendChild(cell);
      }
      this.overlay.appendChild(row);
    }
    this.overlay.style.display = '';
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'none';
  }
}
