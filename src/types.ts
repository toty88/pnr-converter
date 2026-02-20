export type Lang = "es" | "en";
export type Theme = "light" | "dark";

export type FareSummary = {
  currency?: string;
  base?: string;
  taxes?: string;
  total?: string;
  totalAmount?: number;
  baseAmount?: number;
  taxesAmount?: number;
};

export type PnrMeta = {
  passengers?: number;
  bags?: string;
  fare?: FareSummary;
  policies?: string[];
};

export type Segment = {
  idx: number;
  airline?: string;
  flightNumber?: string;
  cabin?: string;
  from?: string;
  to?: string;
  depText?: string;
  arrText?: string;
  duration?: string;
  stops?: string;
  equip?: string;
  operatedBy?: string;
  seat?: string;
  bags?: string;
  depDate?: Date;
  arrDate?: Date;
  transitToNext?: string;
  price?: { raw: string; amount?: number; currency?: string };
};

export type ParseResult = {
  meta: PnrMeta;
  segments: Segment[];
};

export const MONTHS: Record<string, number> = {
  // EN
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
  // ES (non-colliding 3 letters)
  ENE: 0,
  ABR: 3,
  AGO: 7,
  DIC: 11,
  // ES full
  ENERO: 0,
  FEBRERO: 1,
  MARZO: 2,
  ABRIL: 3,
  MAYO: 4,
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
  OCTUBRE: 9,
  NOVIEMBRE: 10,
  DICIEMBRE: 11,
};
