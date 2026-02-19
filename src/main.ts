// src/main.ts
import "./style.css";

/** =========================
 * Types
 * ========================= */
type Lang = "es" | "en";

type FareSummary = {
  currency?: string;
  base?: string;
  taxes?: string;
  total?: string;
  totalAmount?: number;
};

type PnrMeta = {
  passengers?: number;
  bags?: string;
  fare?: FareSummary;
  policies?: string[];
};

type Segment = {
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

type ParseResult = {
  meta: PnrMeta;
  segments: Segment[];
};

/** =========================
 * DOM refs
 * ========================= */
const textarea = document.querySelector<HTMLTextAreaElement>("#input")!;
const output = document.querySelector<HTMLDivElement>("#output")!;
const gutter = document.querySelector<HTMLDivElement>("#gutter")!;

const btnConvert = document.querySelector<HTMLButtonElement>("#btnConvert")!;
const btnClear = document.querySelector<HTMLButtonElement>("#btnClear")!;
const btnCopyHtml = document.querySelector<HTMLButtonElement>("#btnCopyHtml")!;
const btnCopyText = document.querySelector<HTMLButtonElement>("#btnCopyText")!;

const langSel = document.querySelector<HTMLSelectElement>("#lang")!;
const optDuration = document.querySelector<HTMLInputElement>("#optDuration")!;
const optTransit = document.querySelector<HTMLInputElement>("#optTransit")!;
const optClass = document.querySelector<HTMLInputElement>("#optClass")!;
const optBags = document.querySelector<HTMLInputElement>("#optBags")!;
const optPrice = document.querySelector<HTMLInputElement>("#optPrice")!;

const themeToggle = document.querySelector<HTMLInputElement>("#themeToggle")!;

let lastRenderedHtml = "";
let lastRenderedText = "";

/** =========================
 * Utils
 * ========================= */
function clean(s: string) {
  return (s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countLines(s: string) {
  if (!s) return 1;
  return s.split(/\r\n|\r|\n/).length;
}

function renderGutter(n: number) {
  const lines = Array.from({ length: Math.max(1, n) }, (_, i) =>
    String(i + 1),
  ).join("\n");
  gutter.textContent = lines;
}

function formatDurationFromMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function diffMinutes(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function normToken(s: string) {
  return (s ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** =========================
 * Theme
 * ========================= */
type Theme = "light" | "dark";
const THEME_KEY = "pnr_theme";

function systemTheme(): Theme {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === "dark";
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

function initTheme() {
  let theme: Theme | null = null;
  try {
    theme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? null;
  } catch {
    theme = null;
  }
  applyTheme(theme ?? systemTheme());
}

/** =========================
 * Month parsing (no duplicated keys)
 * ========================= */
const MONTHS_EN_3: Record<string, number> = {
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
};

const MONTHS_ES_3: Record<string, number> = {
  ENE: 0,
  FEB: 1,
  MAR: 2,
  ABR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AGO: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DIC: 11,
};

const MONTHS_ES_FULL: Record<string, number> = {
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

function monthFromToken(token: string): number | undefined {
  const k = normToken(token);
  if (!k) return undefined;

  if (k in MONTHS_ES_FULL) return MONTHS_ES_FULL[k];

  const k3 = k.slice(0, 3);
  if (k3 in MONTHS_ES_3) return MONTHS_ES_3[k3];
  if (k3 in MONTHS_EN_3) return MONTHS_EN_3[k3];

  return undefined;
}

function parseDateTextLoose(text: string, baseYear: number) {
  const t = clean(text);
  const m = t.match(
    /(?:^|\s)(\d{1,2})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,})\s+(\d{1,2}:\d{2})/,
  );
  if (!m) return undefined;

  const day = Number(m[1]);
  const mon = monthFromToken(m[2]);
  const time = m[3];

  if (mon === undefined) return undefined;

  const [hh, mm] = time.split(":").map(Number);
  return new Date(baseYear, mon, day, hh, mm, 0, 0);
}

/** =========================
 * Money parsing
 * ========================= */
function parseLocaleNumber(s: string) {
  const raw = clean(s);
  if (!raw) return NaN;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  let norm = raw;

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma > lastDot) norm = raw.replace(/\./g, "").replace(",", ".");
    else norm = raw.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    if (raw.match(/,\d{1,2}$/)) norm = raw.replace(",", ".");
    else norm = raw.replace(/,/g, "");
  } else {
    if (raw.match(/\.\d{1,2}$/)) norm = raw;
    else norm = raw.replace(/\./g, "");
  }

  const n = Number(norm);
  return n;
}

function parseMoneyRaw(
  s: string,
): { currency: string; amount: number } | undefined {
  const t = clean(s);
  const m = t.match(/\b([A-Z]{3})\s*([0-9][0-9\.,]*)\b/);
  if (!m) return undefined;
  const currency = m[1].toUpperCase();
  const amount = parseLocaleNumber(m[2]);
  if (Number.isNaN(amount)) return undefined;
  return { currency, amount };
}

function formatMoney(n: number) {
  return n.toFixed(2);
}

/** =========================
 * Fare parsing from HTML
 * ========================= */
function extractFareFromHtml(doc: Document): FareSummary | undefined {
  const tds = Array.from(doc.querySelectorAll("td"));
  if (!tds.length) return undefined;

  const labelOf = (s: string) =>
    clean(s)
      .replace(/:$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  let base: { currency: string; amount: number } | undefined;
  let taxes: { currency: string; amount: number } | undefined;
  let total: { currency: string; amount: number } | undefined;

  for (let i = 0; i < tds.length - 1; i++) {
    const k = labelOf(tds[i].textContent ?? "");
    if (!k) continue;

    const next = clean(tds[i + 1].textContent ?? "");
    const money = parseMoneyRaw(next);
    if (!money) continue;

    if (k === "fare" || k === "tarifa") base = money;
    if (k === "taxes" || k === "impuestos") taxes = money;
    if (k === "total") total = money;
  }

  if (!base || !taxes || !total) {
    for (const td of tds) {
      const txt = clean(td.textContent ?? "");
      if (!txt) continue;

      const mFare = txt.match(
        /\b(?:fare|tarifa)\b\s*[:\-]?\s*([A-Z]{3})\s*([0-9][0-9\.,]*)/i,
      );
      if (!base && mFare) {
        const amount = parseLocaleNumber(mFare[2]);
        if (!Number.isNaN(amount))
          base = { currency: mFare[1].toUpperCase(), amount };
      }

      const mTaxes = txt.match(
        /\b(?:taxes|impuestos)\b\s*[:\-]?\s*([A-Z]{3})\s*([0-9][0-9\.,]*)/i,
      );
      if (!taxes && mTaxes) {
        const amount = parseLocaleNumber(mTaxes[2]);
        if (!Number.isNaN(amount))
          taxes = { currency: mTaxes[1].toUpperCase(), amount };
      }

      const mTotal = txt.match(
        /\btotal\b\s*[:\-]?\s*([A-Z]{3})\s*([0-9][0-9\.,]*)/i,
      );
      if (!total && mTotal) {
        const amount = parseLocaleNumber(mTotal[2]);
        if (!Number.isNaN(amount))
          total = { currency: mTotal[1].toUpperCase(), amount };
      }
    }
  }

  if (!base && !taxes && !total) return undefined;

  const currency = total?.currency || taxes?.currency || base?.currency;

  return {
    currency,
    base: base ? `${base.currency} ${formatMoney(base.amount)}` : undefined,
    taxes: taxes ? `${taxes.currency} ${formatMoney(taxes.amount)}` : undefined,
    total: total ? `${total.currency} ${formatMoney(total.amount)}` : undefined,
    totalAmount: total?.amount,
  };
}

/** =========================
 * Passengers / bags detection
 * ========================= */
function detectPassengers(text: string): number | undefined {
  const t = clean(text);

  const m1 = t.match(/\b(?:passengers|pasajeros)\b\D{0,10}(\d{1,3})\b/i);
  if (m1) return Number(m1[1]);

  const m2 = t.match(/\b(\d{1,3})\b\s*(?:passengers|pasajeros)\b/i);
  if (m2) return Number(m2[1]);

  return undefined;
}

function detectBags(text: string): string | undefined {
  const t = clean(text);

  const m1 = t.match(/\b(?:bags|equipaje)\b\s*[:\-]?\s*([A-Za-z0-9 ]{1,20})/i);
  if (m1) return clean(m1[1]);

  const m2 = t.match(/\b(\d{1,2}\s*(?:PC|PCS|PIECE|PIECES|BAGS?))\b/i);
  if (m2) return clean(m2[1]);

  const m3 = t.match(/\b(\d{1,2}\s*KG)\b/i);
  if (m3) return clean(m3[1]);

  return undefined;
}

/** =========================
 * HTML segment parsing
 * ========================= */
function parseHtmlPNR(html: string): ParseResult {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const meta: PnrMeta = {};
  const allText = clean(doc.body?.textContent ?? "");
  meta.passengers = detectPassengers(allText);
  meta.bags = detectBags(allText);
  meta.fare = extractFareFromHtml(doc);

  const segments: Segment[] = [];
  const rows = Array.from(doc.querySelectorAll("tr"));

  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll(":scope > td"));
    if (tds.length !== 8) continue;

    const airline = clean(tds[0].textContent ?? "");
    const col2 = clean(tds[1].textContent ?? "");
    const col3 = clean(tds[2].textContent ?? "");
    const col4 = clean(tds[3].textContent ?? "");
    const col5 = clean(tds[4].textContent ?? "");
    const col6 = clean(tds[5].textContent ?? "");
    const col7 = clean(tds[6].textContent ?? "");

    if (!/flight\s*number|n[uú]mero\s*de\s*vuelo/i.test(col2)) continue;
    if (!airline) continue;

    const flightNumber = extractLastToken(col2);
    const cabin = extractAfterLabel(col3);
    const from = extractAfterLabel(col4);
    const depText = extractAfterLabel(col5);
    const to = extractAfterLabel(col6);
    const arrText = extractAfterLabel(col7);

    const col8 = tds[7] as HTMLTableCellElement;
    const details = parseNestedDetails(col8);

    segments.push({
      idx: segments.length + 1,
      airline,
      flightNumber,
      cabin,
      from,
      to,
      depText,
      arrText,
      duration: details.flyingTime,
      stops: details.stops,
      equip: details.type,
      operatedBy: details.operatedBy,
      seat: details.seat,
      bags: details.bags,
    });
  }

  applyDatesAndTransit(segments);
  applyPerFlightPricing(meta, segments);

  return { meta, segments };
}

function extractLastToken(s: string) {
  const t = clean(s);
  const parts = t.split(/\s+/);
  return parts[parts.length - 1] || "";
}

function extractAfterLabel(s: string) {
  const t = clean(s);
  const idx = t.indexOf(":");
  if (idx >= 0) return clean(t.slice(idx + 1));
  return t;
}

function parseNestedDetails(td: HTMLTableCellElement) {
  const details: {
    flyingTime?: string;
    stops?: string;
    type?: string;
    operatedBy?: string;
    seat?: string;
    bags?: string;
  } = {};

  const innerRows = Array.from(td.querySelectorAll("tr"));
  for (const r of innerRows) {
    const cells = Array.from(r.querySelectorAll("td"));
    if (cells.length < 2) continue;

    const k = clean(cells[0].textContent ?? "")
      .replace(/:$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    const v = clean(cells[1].textContent ?? "");
    if (!k || !v) continue;

    if (k.includes("flying time") || k.includes("duracion del vuelo"))
      details.flyingTime = v;
    if (k.includes("stops") || k.includes("escalas")) details.stops = v;
    if (k === "type" || k.includes("tipo")) details.type = v;
    if (k.includes("operated by") || k.includes("operado por"))
      details.operatedBy = v;
    if (k.includes("seat") || k.includes("asiento")) details.seat = v;
    if (k.includes("bags") || k.includes("equipaje")) details.bags = v;
  }

  return details;
}

function applyDatesAndTransit(segments: Segment[]) {
  if (segments.length === 0) return;

  let year = new Date().getFullYear();
  let lastMonth = -1;

  for (const seg of segments) {
    const dep = seg.depText ? parseDateTextLoose(seg.depText, year) : undefined;
    const arr = seg.arrText ? parseDateTextLoose(seg.arrText, year) : undefined;

    if (dep && lastMonth >= 0 && dep.getMonth() < lastMonth) {
      year += 1;
      seg.depDate = seg.depText ? parseDateTextLoose(seg.depText, year) : dep;
      seg.arrDate = seg.arrText ? parseDateTextLoose(seg.arrText, year) : arr;
      lastMonth = seg.depDate?.getMonth() ?? lastMonth;
    } else {
      seg.depDate = dep;
      seg.arrDate = arr;
      if (dep) lastMonth = dep.getMonth();
    }

    if (
      seg.depDate &&
      seg.arrDate &&
      seg.arrDate.getTime() < seg.depDate.getTime()
    ) {
      seg.arrDate = new Date(seg.arrDate.getTime() + 24 * 60 * 60000);
    }
  }

  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i].arrDate;
    const b = segments[i + 1].depDate;
    if (a && b) {
      const mins = diffMinutes(a, b);
      if (mins >= 0)
        segments[i].transitToNext = formatDurationFromMinutes(mins);
    }
  }
}

function applyPerFlightPricing(meta: PnrMeta, segments: Segment[]) {
  const totalAmount = meta.fare?.totalAmount;
  const currency = meta.fare?.currency;
  if (!totalAmount || !currency) return;
  if (segments.length === 0) return;

  const per = totalAmount / segments.length;
  for (const s of segments) {
    s.price = { currency, amount: per, raw: `${currency} ${formatMoney(per)}` };
  }
}

/** =========================
 * RAW parsing (minimal)
 * ========================= */
function parseRawPNR(raw: string): ParseResult {
  const meta: PnrMeta = {};
  meta.passengers = detectPassengers(raw);
  meta.bags = detectBags(raw);

  const lines = raw
    .split(/\r\n|\r|\n/)
    .map(clean)
    .filter(Boolean);

  const segments: Segment[] = [];

  const re =
    /^\d+\s+([A-Z0-9]{1,3})\s+([0-9]{1,4}[A-Z0-9]?)\s+([A-Z])\s+(\d{1,2})([A-Z]{3})\s+\d+\s+([A-Z]{3})([A-Z]{3})\s+.*?\s(\d{3,4})\s(\d{3,4})/i;

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;

    const flightNumber = `${m[1]}${m[2]}`;
    const cabin = m[3];
    const day = m[4];
    const mon = m[5];
    const from = m[6];
    const to = m[7];
    const dep = m[8];
    const arr = m[9];

    segments.push({
      idx: segments.length + 1,
      airline: m[1],
      flightNumber,
      cabin: cabin ? `${cabin}-Class` : undefined,
      from,
      to,
      depText: `${day} ${mon} ${dep.slice(0, 2)}:${dep.slice(2)}`,
      arrText: `${day} ${mon} ${arr.slice(0, 2)}:${arr.slice(2)}`,
    });
  }

  applyDatesAndTransit(segments);
  return { meta, segments };
}

/** =========================
 * Rendering
 * ========================= */
function t(lang: Lang) {
  return lang === "es"
    ? {
        general: "Resumen general",
        flights: "Tus vuelos",
        table: "Tabla",
        passengers: "Pasajeros",
        bags: "Equipaje",
        fare: "Tarifa",
        taxes: "Impuestos",
        total: "Total",
        perFlight: "Por vuelo",
        price: "Precio",
        leaving: "Saliendo",
        arriving: "Llegando",
        duration: "Duración",
        stops: "Escalas",
        class: "Clase",
        transit: "Tiempo de conexión",
        airline: "Aerolínea",
        flight: "Vuelo",
        date: "Fecha",
        from: "Origen",
        to: "Destino",
        dep: "Sale",
        arr: "Llega",
      }
    : {
        general: "General summary",
        flights: "Your flights",
        table: "Table",
        passengers: "Passengers",
        bags: "Baggage",
        fare: "Fare",
        taxes: "Taxes",
        total: "Total",
        perFlight: "Per flight",
        price: "Price",
        leaving: "Leaving",
        arriving: "Arriving",
        duration: "Duration",
        stops: "Stops",
        class: "Class",
        transit: "Transit time",
        airline: "Airline",
        flight: "Flight",
        date: "Date",
        from: "From",
        to: "Destination",
        dep: "Depart",
        arr: "Arrive",
      };
}

function priceBadge(text: string, variant: "normal" | "total" = "normal") {
  const cls = variant === "total" ? "price-badge price-total" : "price-badge";
  return `<span class="${cls}"><span class="dot"></span><span class="mono">${escapeHtml(text)}</span></span>`;
}

function accordion(titleHtml: string, bodyHtml: string, open = false) {
  return `
    <details class="acc" ${open ? "open" : ""}>
      <summary>
        <div class="acc-title">${titleHtml}</div>
        <span class="chev">›</span>
      </summary>
      <div class="acc-body">${bodyHtml}</div>
    </details>
  `;
}

function renderPills(meta: PnrMeta, lang: Lang) {
  const L = t(lang);
  const pills: string[] = [];
  if (meta.passengers) {
    pills.push(
      `<span class="pill"><span class="k">${L.passengers}:</span><span class="v">${meta.passengers}</span></span>`,
    );
  }
  if (meta.bags) {
    pills.push(
      `<span class="pill"><span class="k">${L.bags}:</span><span class="v">${escapeHtml(meta.bags)}</span></span>`,
    );
  }
  return pills.length ? `<div class="pills">${pills.join("")}</div>` : "";
}

function renderPriceSummary(meta: PnrMeta, lang: Lang, flightCount: number) {
  const L = t(lang);
  const fare = meta.fare;
  if (!fare) return "";

  const perFlight =
    fare.totalAmount && flightCount > 0 && fare.currency
      ? `${fare.currency} ${formatMoney(fare.totalAmount / flightCount)}`
      : undefined;

  return `
    <div class="price-card">
      <div class="price-row">
        <div class="price-k">${L.fare}</div>
        <div>${fare.base ? priceBadge(fare.base, "normal") : "-"}</div>
      </div>
      <div class="price-row">
        <div class="price-k">${L.taxes}</div>
        <div>${fare.taxes ? priceBadge(fare.taxes, "normal") : "-"}</div>
      </div>
      <div class="price-row">
        <div class="price-k">${L.total}</div>
        <div>${fare.total ? priceBadge(fare.total, "total") : "-"}</div>
      </div>
      ${
        perFlight
          ? `
        <div class="price-row" style="margin-top:10px;">
          <div class="price-k">${L.perFlight}</div>
          <div>${priceBadge(perFlight, "total")}</div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function renderFlightTitle(seg: Segment, lang: Lang) {
  const d = seg.depText ? escapeHtml(seg.depText) : "";
  const airline = seg.airline ? escapeHtml(seg.airline) : "";
  const flight = seg.flightNumber ? escapeHtml(seg.flightNumber) : "";
  const cabin = seg.cabin ? escapeHtml(seg.cabin) : "";
  const dur = seg.duration ? escapeHtml(seg.duration) : "";

  const rightBits: string[] = [];
  if (optClass.checked && cabin)
    rightBits.push(`<span class="fh-badge">${cabin}</span>`);
  if (optDuration.checked && dur)
    rightBits.push(`<span class="fh-badge">${dur}</span>`);
  if (optPrice.checked && seg.price?.raw) {
    rightBits.push(
      `<span class="fh-price">${priceBadge(seg.price.raw, "total")}</span>`,
    );
  }

  return `
    <div class="flightHeader">
      <div class="fh-left">
        ${d ? `<span class="fh-date">${d}</span>` : ""}
        ${airline ? `<span class="fh-airline">${airline}</span>` : ""}
        ${flight ? `<span class="fh-flight">${flight}</span>` : ""}
      </div>
      <div class="fh-right">
        ${rightBits.join("")}
      </div>
    </div>
  `;
}

function renderFlightBody(seg: Segment, lang: Lang) {
  const L = t(lang);

  const leaving =
    seg.from && seg.depText
      ? `<div class="flightLine"><b>${L.leaving}:</b> ${escapeHtml(seg.from)} <span class="small">(${escapeHtml(seg.depText)})</span></div>`
      : seg.from
        ? `<div class="flightLine"><b>${L.leaving}:</b> ${escapeHtml(seg.from)}</div>`
        : "";

  const arriving =
    seg.to && seg.arrText
      ? `<div class="flightLine"><b>${L.arriving}:</b> ${escapeHtml(seg.to)} <span class="small">(${escapeHtml(seg.arrText)})</span></div>`
      : seg.to
        ? `<div class="flightLine"><b>${L.arriving}:</b> ${escapeHtml(seg.to)}</div>`
        : "";

  const dur =
    optDuration.checked && seg.duration
      ? `<div class="flightLine"><b>${L.duration}:</b> ${escapeHtml(seg.duration)}</div>`
      : "";

  const stops = seg.stops
    ? `<div class="flightLine"><b>${L.stops}:</b> ${escapeHtml(seg.stops)}</div>`
    : "";

  const cls =
    optClass.checked && seg.cabin
      ? `<div class="flightLine"><b>${L.class}:</b> ${escapeHtml(seg.cabin)}</div>`
      : "";

  const equip = seg.equip
    ? `<div class="flightLine"><b>Type:</b> ${escapeHtml(seg.equip)}</div>`
    : "";
  const op = seg.operatedBy
    ? `<div class="flightLine"><b>Operated by:</b> ${escapeHtml(seg.operatedBy)}</div>`
    : "";
  const seat = seg.seat
    ? `<div class="flightLine"><b>Seat:</b> ${escapeHtml(seg.seat)}</div>`
    : "";
  const bags =
    optBags.checked && seg.bags
      ? `<div class="flightLine"><b>${L.bags}:</b> ${escapeHtml(seg.bags)}</div>`
      : "";

  const price =
    optPrice.checked && seg.price?.raw
      ? `<div class="flightLine"><b>${L.price}:</b> ${priceBadge(seg.price.raw, "total")}</div>`
      : "";

  return `
    ${leaving}
    ${arriving}
    ${price}
    ${cls}
    ${dur}
    ${stops}
    ${bags}
    ${equip}
    ${op}
    ${seat}
  `;
}

function renderTransitHint(seg: Segment, lang: Lang) {
  const L = t(lang);
  if (!optTransit.checked) return "";
  if (!seg.transitToNext) return "";
  return `<div class="centerHint">------ ${L.transit}: ${escapeHtml(seg.transitToNext)} ------</div>`;
}

function renderTable(result: ParseResult, lang: Lang) {
  const L = t(lang);
  const showDur = optDuration.checked;
  const showCls = optClass.checked;
  const showBags = optBags.checked;
  const showPrice = optPrice.checked;

  const cols: string[] = [
    `<th>${L.date}</th>`,
    `<th>${L.airline}</th>`,
    `<th>${L.flight}</th>`,
    showCls ? `<th>${L.class}</th>` : "",
    `<th>${L.from}</th>`,
    `<th>${L.dep}</th>`,
    `<th>${L.to}</th>`,
    `<th>${L.arr}</th>`,
    showDur ? `<th>${L.duration}</th>` : "",
    showPrice ? `<th>${L.price}</th>` : "",
    `<th>${L.stops}</th>`,
    showBags ? `<th>${L.bags}</th>` : "",
  ].filter(Boolean);

  const rows = result.segments
    .map((s) => {
      const date = s.depText ? escapeHtml(s.depText) : "";
      const airline = s.airline ? escapeHtml(s.airline) : "";
      const flight = s.flightNumber ? escapeHtml(s.flightNumber) : "";
      const cls = s.cabin ? escapeHtml(s.cabin) : "";
      const from = s.from ? escapeHtml(s.from) : "";
      const to = s.to ? escapeHtml(s.to) : "";
      const dep = s.depText ? extractTimeOnly(s.depText) : "";
      const arr = s.arrText ? extractTimeOnly(s.arrText) : "";
      const dur = s.duration ? escapeHtml(s.duration) : "";
      const stops = s.stops ? escapeHtml(s.stops) : "";
      const bags =
        s.bags || result.meta.bags
          ? escapeHtml(s.bags || result.meta.bags || "")
          : "";
      const price = s.price?.raw ? priceBadge(s.price.raw, "total") : "";

      const tds: string[] = [
        `<td>${date}</td>`,
        `<td>${airline}</td>`,
        `<td>${flight}</td>`,
        showCls ? `<td>${cls}</td>` : "",
        `<td>${from}</td>`,
        `<td>${escapeHtml(dep)}</td>`,
        `<td>${to}</td>`,
        `<td>${escapeHtml(arr)}</td>`,
        showDur ? `<td>${dur}</td>` : "",
        showPrice ? `<td>${price}</td>` : "",
        `<td>${stops}</td>`,
        showBags ? `<td>${bags}</td>` : "",
      ].filter(Boolean);

      return `<tr>${tds.join("")}</tr>`;
    })
    .join("");

  return `
    <div class="tableWrap">
      <table>
        <thead><tr>${cols.join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function extractTimeOnly(s: string) {
  const t = clean(s);
  const m = t.match(/(\d{1,2}:\d{2})\b/);
  return m ? m[1] : t;
}

function renderOutput(result: ParseResult, lang: Lang) {
  const L = t(lang);

  const generalBody = `
    ${renderPriceSummary(result.meta, lang, result.segments.length)}
    ${renderPills(result.meta, lang)}
  `;

  const generalAcc = accordion(
    escapeHtml(L.general),
    generalBody || `<div class="small">-</div>`,
    true,
  );

  const flightsBody = result.segments.length
    ? result.segments
        .map((s, idx) => {
          const titleHtml = renderFlightTitle(s, lang);
          const body = `
            ${renderFlightBody(s, lang)}
            ${idx < result.segments.length - 1 ? `<div class="hr"></div>${renderTransitHint(s, lang)}` : ""}
          `;
          return accordion(titleHtml || escapeHtml(`#${s.idx}`), body, false);
        })
        .join("")
    : `<div class="small">No se detectaron segmentos de vuelo.</div>`;

  const flightsAcc = accordion(escapeHtml(L.flights), flightsBody, true);
  const tableAcc = accordion(
    escapeHtml(L.table),
    renderTable(result, lang),
    true,
  );

  const html = `${generalAcc}${flightsAcc}${tableAcc}`;

  const textLines: string[] = [];
  if (result.meta.fare?.total) {
    textLines.push(`${L.total}: ${result.meta.fare.total}`);
    if (result.meta.fare.totalAmount && result.segments.length) {
      const per = `${result.meta.fare.currency} ${formatMoney(result.meta.fare.totalAmount / result.segments.length)}`;
      textLines.push(`${L.perFlight}: ${per}`);
    }
    textLines.push("");
  }
  if (result.meta.passengers)
    textLines.push(`${L.passengers}: ${result.meta.passengers}`);
  if (result.meta.bags) textLines.push(`${L.bags}: ${result.meta.bags}`);
  if (result.meta.passengers || result.meta.bags) textLines.push("");

  result.segments.forEach((s, i) => {
    const titlePlain = clean(
      renderFlightTitle(s, lang).replace(/<[^>]+>/g, " "),
    );
    textLines.push(`#${i + 1} ${titlePlain}`);
    if (s.from)
      textLines.push(
        `${L.leaving}: ${s.from} ${s.depText ? `(${s.depText})` : ""}`.trim(),
      );
    if (s.to)
      textLines.push(
        `${L.arriving}: ${s.to} ${s.arrText ? `(${s.arrText})` : ""}`.trim(),
      );
    if (optPrice.checked && s.price?.raw)
      textLines.push(`${L.price}: ${s.price.raw}`);
    if (optDuration.checked && s.duration)
      textLines.push(`${L.duration}: ${s.duration}`);
    if (optClass.checked && s.cabin) textLines.push(`${L.class}: ${s.cabin}`);
    if (s.stops) textLines.push(`${L.stops}: ${s.stops}`);
    if (optBags.checked && (s.bags || result.meta.bags))
      textLines.push(`${L.bags}: ${s.bags || result.meta.bags}`);
    if (optTransit.checked && s.transitToNext)
      textLines.push(`${L.transit}: ${s.transitToNext}`);
    textLines.push("");
  });

  return { html, text: textLines.join("\n").trim() };
}

/** =========================
 * Convert pipeline
 * ========================= */
function convert() {
  const input = textarea.value.trim();
  const lang = (langSel.value as Lang) || "es";

  if (!input) {
    output.innerHTML = `<div class="small">Pegá un PNR RAW o HTML para convertir.</div>`;
    lastRenderedHtml = "";
    lastRenderedText = "";
    return;
  }

  const isHtml =
    input.startsWith("<") || input.includes("<HTML") || input.includes("<html");
  const result = isHtml ? parseHtmlPNR(input) : parseRawPNR(input);

  const rendered = renderOutput(result, lang);
  output.innerHTML = rendered.html;

  lastRenderedHtml = rendered.html;
  lastRenderedText = rendered.text;
}

/** =========================
 * Clipboard
 * ========================= */
async function copyHtmlToClipboard(html: string) {
  const blobHtml = new Blob([html], { type: "text/html" });
  const blobText = new Blob([stripHtml(html)], { type: "text/plain" });

  // @ts-ignore
  if (
    navigator.clipboard &&
    "write" in navigator.clipboard &&
    typeof ClipboardItem !== "undefined"
  ) {
    // @ts-ignore
    const item = new ClipboardItem({
      "text/html": blobHtml,
      "text/plain": blobText,
    });
    // @ts-ignore
    await navigator.clipboard.write([item]);
  } else {
    await navigator.clipboard.writeText(stripHtml(html));
  }
}

function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return clean(div.textContent ?? "");
}

/** =========================
 * Events
 * ========================= */
textarea.addEventListener("input", () =>
  renderGutter(countLines(textarea.value)),
);

textarea.addEventListener("scroll", () => {
  gutter.scrollTop = textarea.scrollTop;
});

btnConvert.addEventListener("click", convert);

btnClear.addEventListener("click", () => {
  textarea.value = "";
  renderGutter(1);
  output.innerHTML = "";
  lastRenderedHtml = "";
  lastRenderedText = "";
});

btnCopyHtml.addEventListener("click", async () => {
  if (!lastRenderedHtml) return;
  await copyHtmlToClipboard(lastRenderedHtml);
});

btnCopyText.addEventListener("click", async () => {
  if (!lastRenderedText) return;
  await navigator.clipboard.writeText(lastRenderedText);
});

[langSel, optDuration, optTransit, optClass, optBags, optPrice].forEach(
  (el) => {
    el.addEventListener("change", convert);
  },
);

themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
});

/** init */
initTheme();
renderGutter(1);
convert();
