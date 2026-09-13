import type { SupportedLocale } from '../locale'
import { en, type Messages } from './en'
import { ptBR } from './pt-BR'
import { fr } from './fr'
import { es } from './es'

export type { Messages }

export const MESSAGES_BY_LOCALE: Record<SupportedLocale, Messages> = {
  en,
  'pt-BR': ptBR,
  fr,
  es,
}

/** Union of every dot-path key in the message tree (leaves are always strings). */
export type MessageKey = DotPaths<Messages>

type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : DotPaths<T[K], `${Prefix}${K}.`>
}[keyof T & string]
