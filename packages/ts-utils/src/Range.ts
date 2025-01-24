import type { Brand } from 'effect';
import { Schema as S } from 'effect';

/**
 * Utility type for enumerating numbers [0, N) over a tuple.
 */
export type Enumerate<N extends number, Acc extends Array<number> = []> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>;

/**
 * Utility type that generates a union of positive numbers [From, To).
 */
export type IntRange<From extends number, To extends number> = Exclude<Enumerate<To>, Enumerate<From>>;

/**
 * Utility type to get the length of a tuple.
 */
export type Length<T extends Array<unknown>> = T extends { length: infer L } ? L : never;

/**
 * Branded type for floats between [0.0, 1.0].
 */
export type Normalized<Denominator extends number = 1, N extends number = number> = N extends number
  ? Brand.Branded<number, `Normalized<${Denominator}${number extends N ? '' : `${N}, `}>`>
  : never;

export type NumberLiteral<N extends number> = number extends N ? never : N;

export type Percent<N extends number = number> = Normalized<100, N>;

export type Range<From extends number, To extends number> = [From, To] extends [NumberLiteral<From>, NumberLiteral<To>]
  ? Brand.Branded<number, RangeTemplateLiteral<From, To>>
  : never;

export type RangeTemplateLiteral<From extends number, To extends number> = [From, To] extends [
  NumberLiteral<From>,
  NumberLiteral<To>,
]
  ? `Range<${From}, ${To}>`
  : never;

export const IntRange: <From extends number, To extends number>(
  from: NumberLiteral<From>,
  to: NumberLiteral<To>,
) => S.Schema<IntRange<From, To>, number> = <From extends number, To extends number>(from: From, to: To) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  S.Int.pipe(
    S.greaterThanOrEqualTo(from),
    S.lessThan(to),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

export const Range: <From extends number, To extends number>(
  from: NumberLiteral<From>,
  to: NumberLiteral<To>,
) => S.Schema<Range<From, To>, number> = <From extends number, To extends number>(
  from: NumberLiteral<From>,
  to: NumberLiteral<To>,
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
  S.Number.pipe(S.greaterThanOrEqualTo(from), S.lessThan(to), S.asSchema) as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
export const Normalized: S.Schema<Normalized, number> = Range(0, 1) as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
export const Percent: S.Schema<Percent, number> = Range(0, 100) as any;

export const NormalizedFromPercent = S.transform(Percent, Normalized, {
  decode: (to) => (to / 100) as Normalized,
  encode: (_, from) => (from * 100) as Percent,
  strict: true,
});

export const PercentFromNormalized = S.transform(Normalized, Percent, {
  decode: (from) => (from * 100) as Percent,
  encode: (_, to) => (to / 100) as Normalized,
  strict: true,
});
