import type { ReactNode } from 'react';
import type { ItemType } from '../../domain/types';
import { TYPE_LABEL } from '../common';

export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'critical';

export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function TypeChip({ type }: { type: ItemType }) {
  return <span className={`chip chip-${type}`}>{TYPE_LABEL[type]}</span>;
}

/** Código de ítem con tipografía monoespaciada. */
export function ItemCode({ code, large }: { code: string; large?: boolean }) {
  return <span className={large ? 'item-code item-code-lg' : 'item-code'}>{code}</span>;
}
