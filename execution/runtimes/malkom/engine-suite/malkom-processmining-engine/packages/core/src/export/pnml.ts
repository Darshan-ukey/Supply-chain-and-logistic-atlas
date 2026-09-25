import type { PetriNet } from '../runtime/petrinet.js';
import type { ProcessTree } from '../runtime/inductive.js';
import { treeToPetriNet } from '../runtime/petrinet.js';
import { XmlWriter } from './xml.js';

/**
 * PNML export — the interchange format ProM and Apromore read.
 *
 * The Petri net already exists because conformance replay needed one, so this
 * is mostly serialisation. It matters more than that suggests: exporting to
 * PNML is how a discovered model gets checked against an independent
 * implementation, and an engine whose results cannot be verified elsewhere
 * asks to be trusted on its own word.
 */

export interface PnmlOptions {
  /** Net id in the file. Default 'net1'. */
  netId?: string;
  /** Human-readable name shown by the importing tool. */
  name?: string;
}

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';
const PT_NET = 'http://www.pnml.org/version-2009/grammar/ptnet';

export function toPnml(net: PetriNet, opts: PnmlOptions = {}): string {
  const xml = new XmlWriter();
  xml.declaration();
  xml.open('pnml', { xmlns: PNML_NS });
  xml.open('net', { id: opts.netId ?? 'net1', type: PT_NET });

  xml.open('name');
  xml.text('text', opts.name ?? 'Malkom discovered model');
  xml.close('name');

  xml.open('page', { id: 'page1' });

  for (const place of net.places) {
    xml.open('place', { id: place });
    xml.open('name');
    xml.text('text', place);
    xml.close('name');
    // Only the source place holds a token. A net whose initial marking is
    // wrong replays differently in every tool that opens it.
    if (place === net.initial) {
      xml.open('initialMarking');
      xml.text('text', '1');
      xml.close('initialMarking');
    }
    xml.close('place');
  }

  for (const transition of net.transitions) {
    xml.open('transition', { id: transition.id });
    xml.open('name');
    // A silent transition keeps an empty name; ProM renders it as a black bar
    // and, crucially, does not treat it as an observable activity.
    xml.text('text', transition.label ?? '');
    xml.close('name');
    if (transition.label === null) {
      // ProM's own marker for an invisible transition. Without it, a tau
      // becomes an activity nobody ever performed and every conformance
      // measure computed elsewhere disagrees with ours.
      xml.open('toolspecific', { tool: 'ProM', version: '6.4', activity: '$invisible$' });
      xml.close('toolspecific');
    }
    xml.close('transition');
  }

  for (const [i, arc] of net.arcs.entries()) {
    xml.empty('arc', { id: `arc${i + 1}`, source: arc.from, target: arc.to });
  }

  xml.close('page');

  // The final marking, as ProM's import expects it.
  xml.open('finalmarkings');
  xml.open('marking');
  xml.open('place', { idref: net.final });
  xml.text('text', '1');
  xml.close('place');
  xml.close('marking');
  xml.close('finalmarkings');

  xml.close('net');
  xml.close('pnml');
  return xml.toString();
}

/** Convenience: process tree straight to PNML. */
export function treeToPnml(tree: ProcessTree, opts: PnmlOptions = {}): string {
  return toPnml(treeToPetriNet(tree), opts);
}
