/** Popover showing a saved prefilter's conditions in plain English. */

import { describeCondition, type ConditionFieldInfo, type SmartPrefilter } from '../conditions.js';
import type { MalkomTableIcons, MalkomTableLabels, MalkomTableTheme } from '../types.js';
import { containsTarget, el, icon, onEscape, onOutsideClick } from './dom.js';
import { adoptShellTheme } from './overlay.js';
import { renderConditionPreview, renderPreviewEmpty } from './previewRender.js';

export interface SavedPreviewDeps {
  doc: Document;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
  fields: ConditionFieldInfo[];
  /** The .mte-shell element — the scope the design tokens live on. */
  shellRoot: HTMLElement;
}

export class SavedPreviewPopover {
  private dispose: (() => void) | null = null;
  private currentId: string | null = null;

  constructor(private readonly deps: SavedPreviewDeps) {}

  /** Toggle the popover for a prefilter near an anchor element. */
  toggle(prefilter: SmartPrefilter, anchor: HTMLElement): void {
    if (this.currentId === prefilter.id) {
      this.close();
      return;
    }
    this.close();
    this.show(prefilter, anchor);
  }

  close(): void {
    if (this.dispose) {
      this.dispose();
      this.dispose = null;
    }
    this.currentId = null;
  }

  private show(prefilter: SmartPrefilter, anchor: HTMLElement): void {
    const { doc, theme, labels, icons: ic, fields } = this.deps;

    const popover = el(doc, 'div', {
      className: theme.savedPreviewPopover.container
    });

    const header = el(doc, 'div', { className: theme.savedPreviewPopover.header });
    const headLeft = el(doc, 'div', { className: 'flex items-start gap-2' });
    const headIcon = el(doc, 'span', {
      className: theme.savedPreviewPopover.headerIcon
    });
    headIcon.appendChild(
      icon(doc, ic.visibility, 'material-symbols-rounded text-[21px]')
    );
    const headText = el(doc, 'div');
    headText.append(
      el(doc, 'p', {
        className: theme.savedPreviewPopover.headerTitle,
        text: prefilter.name
      }),
      el(doc, 'p', {
        className: theme.savedPreviewPopover.headerSubtitle,
        text: labels.previewSubtitle
      })
    );
    headLeft.append(headIcon, headText);
    const closeBtn = el(doc, 'button', {
      className: theme.savedPreviewPopover.closeButton,
      type: 'button'
    });
    closeBtn.appendChild(icon(doc, ic.close, 'material-symbols-rounded text-[18px]'));
    closeBtn.addEventListener('click', () => this.close());
    header.append(headLeft, closeBtn);

    const body = el(doc, 'div', { className: theme.savedPreviewPopover.body });
    if (prefilter.root.children.length === 0) {
      body.appendChild(renderPreviewEmpty({ doc, theme, labels, icons: ic }));
    } else {
      body.appendChild(
        renderConditionPreview(
          { doc, theme, labels, icons: ic },
          describeCondition(prefilter.root, fields, labels.operatorLabels)
        )
      );
    }

    popover.append(header, body);
    adoptShellTheme(this.deps.shellRoot, popover);
    doc.body.appendChild(popover);

    // Position near anchor, clamped into the viewport
    const rect = anchor.getBoundingClientRect();
    const win = doc.defaultView;
    const viewportWidth = win?.innerWidth ?? 1024;
    const viewportHeight = win?.innerHeight ?? 768;
    const width = Math.min(520, viewportWidth - 32);
    const left = Math.min(Math.max(16, rect.right - width), viewportWidth - width - 16);
    const height = popover.offsetHeight || 240;
    const top = Math.max(16, Math.min(rect.bottom + 10, viewportHeight - height - 16));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    const disposeOutside = onOutsideClick(
      doc,
      (target) => containsTarget(popover, target) || containsTarget(anchor, target),
      () => this.close()
    );
    const disposeEscape = onEscape(doc, () => this.close());

    this.currentId = prefilter.id;
    this.dispose = (): void => {
      disposeOutside();
      disposeEscape();
      popover.remove();
    };
  }
}
