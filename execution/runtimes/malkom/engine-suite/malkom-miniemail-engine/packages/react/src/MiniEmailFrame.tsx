import { useEffect, useRef, type ReactElement } from 'react';
import {
  SealedFrame,
  type MiniEmailAttachment,
  type MiniEmailMessage,
  type ResolvedMiniEmailOptions
} from '@malkom/miniemail-core';

/**
 * Renders one message inside a sealed frame.
 *
 * The frame is imperative and owns its own document, so React is kept out of
 * its internals: it mounts once per message and is told what changed, rather
 * than being re-created whenever a parent re-renders.
 */

export interface MiniEmailFrameProps {
  readonly message: MiniEmailMessage;
  readonly options: ResolvedMiniEmailOptions;
  /** Overrides the config default once the reader trusts this sender. */
  readonly blockRemoteImages?: boolean;
  /** True once the reader has asked to see remote images. */
  readonly imagesRevealed?: boolean;
  readonly quoteVisible?: boolean;
  readonly onRendered?: (result: {
    readonly blockedImageCount: number;
    readonly hasQuotedContent: boolean;
  }) => void;
  readonly onHeightChange?: (height: number) => void;
  readonly className?: string;
}

export function MiniEmailFrame(props: MiniEmailFrameProps): ReactElement {
  const {
    message,
    options,
    blockRemoteImages,
    imagesRevealed = false,
    quoteVisible,
    onRendered,
    onHeightChange,
    className
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<SealedFrame | null>(null);

  // Callbacks are read through a ref so a host passing inline arrows does not
  // tear down and rebuild the frame on every render.
  const callbacks = useRef({ onRendered, onHeightChange });
  callbacks.current = { onRendered, onHeightChange };

  const attachmentKey = message.attachments
    .map((attachment: MiniEmailAttachment) => `${attachment.id}:${attachment.content ? 1 : 0}`)
    .join(',');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const frame = new SealedFrame(container, (height) =>
      callbacks.current.onHeightChange?.(height)
    );
    frameRef.current = frame;

    const result = frame.render({
      html: message.body.content,
      attachments: message.attachments,
      options,
      ...(blockRemoteImages !== undefined ? { blockRemoteImages } : {})
    });

    callbacks.current.onRendered?.({
      blockedImageCount: result.blockedImageCount,
      hasQuotedContent: result.hasQuotedContent
    });

    return () => {
      frame.destroy();
      frameRef.current = null;
    };
    // Re-render the frame only when the message itself, the attachment bytes,
    // or the image policy actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.body.content, attachmentKey, options, blockRemoteImages]);

  useEffect(() => {
    if (imagesRevealed) frameRef.current?.revealImages();
  }, [imagesRevealed]);

  useEffect(() => {
    if (quoteVisible !== undefined) frameRef.current?.toggleQuote(quoteVisible);
  }, [quoteVisible]);

  return <div ref={containerRef} className={className} />;
}
