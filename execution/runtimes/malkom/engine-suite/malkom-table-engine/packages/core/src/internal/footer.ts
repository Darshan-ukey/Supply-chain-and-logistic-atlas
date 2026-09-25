/** Custom controls injected into Tabulator's footer: page size + row counts. */

import type { MalkomTableLabels, MalkomTableTheme } from '../types.js';
import { el } from './dom.js';

export interface FooterControls {
  updateCounts(total: number, filtered: number): void;
  setPageSize(size: number): void;
  dispose(): void;
}

export function injectFooterControls(options: {
  doc: Document;
  gridRoot: HTMLElement;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  sizes: number[];
  currentSize: number;
  onPageSizeChange: (size: number) => void;
}): FooterControls | null {
  const { doc, gridRoot, theme, labels, sizes, currentSize, onPageSizeChange } =
    options;
  const footer = gridRoot.querySelector('.tabulator-footer');
  if (!footer) return null;

  // Remove ghosts from re-init
  footer.querySelectorAll('.mte-footer-controls').forEach((n) => n.remove());

  const container = el(doc, 'div', { className: theme.footer.container });
  const label = el(doc, 'span', {
    className: theme.footer.pageSizeLabel,
    text: labels.rowsPerPage
  });
  const select = el(doc, 'select', { className: theme.footer.pageSizeSelect });
  for (const size of sizes) {
    const option = el(doc, 'option', { text: String(size) });
    option.value = String(size);
    if (size === currentSize) option.selected = true;
    select.appendChild(option);
  }
  const divider = el(doc, 'span', { className: theme.footer.divider });

  const counts = el(doc, 'span', { className: theme.footer.counts });
  const totalGroup = el(doc, 'span', { className: theme.footer.countGroup });
  const totalLabel = el(doc, 'span', {
    className: theme.footer.countLabel,
    text: labels.totalRows
  });
  const totalValue = el(doc, 'span', { className: theme.footer.countValue, text: '0' });
  totalGroup.append(totalLabel, totalValue);

  const filteredGroup = el(doc, 'span', { className: theme.footer.filteredGroup });
  const filteredLabel = el(doc, 'span', {
    className: theme.footer.filteredLabel,
    text: labels.filteredRows
  });
  const filteredValue = el(doc, 'span', {
    className: theme.footer.filteredValue,
    text: '0'
  });
  filteredGroup.append(filteredLabel, filteredValue);
  counts.append(totalGroup, filteredGroup);

  container.append(label, select, divider, counts);
  footer.insertBefore(container, footer.firstChild);

  const changeHandler = (): void => {
    const parsed = Number.parseInt(select.value, 10);
    if (Number.isFinite(parsed)) onPageSizeChange(parsed);
  };
  select.addEventListener('change', changeHandler);

  return {
    updateCounts(total: number, filtered: number): void {
      totalValue.textContent = String(total);
      filteredValue.textContent = String(filtered);
    },
    setPageSize(size: number): void {
      select.value = String(size);
    },
    dispose(): void {
      select.removeEventListener('change', changeHandler);
      container.remove();
    }
  };
}
