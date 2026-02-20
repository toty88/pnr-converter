// src/i18n.ts
import type { Lang } from "./types";

export type Labels = {
  general: string;
  flights: string;
  table: string;
  passengers: string;
  bags: string;
  fare: string;
  taxes: string;
  total: string;
  perFlight: string;
  price: string;
  duration: string;
  stops: string;
  class: string;
  airline: string;
  flight: string;
  fromOut: string;
  toIn: string;
  noSegments: string;
  leaving: string;
  arriving: string;
  transit: string;
  copyRates: string;
};

const DICT: Record<Lang, Labels> = {
  es: {
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
    duration: "Duración",
    stops: "Stops",
    class: "Clase",
    airline: "Aerolínea",
    flight: "Vuelo",
    fromOut: "Origen (Salida)",
    toIn: "Destino (Arribo)",
    noSegments: "No se detectaron segmentos de vuelo.",
    leaving: "Salida",
    arriving: "Arribo",
    transit: "Tiempo de conexión",
    copyRates: "Copiar con tarifas",
  },
  en: {
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
    duration: "Duration",
    stops: "Stops",
    class: "Class",
    airline: "Airline",
    flight: "Flight",
    fromOut: "Origin (Departure)",
    toIn: "Destination (Arrival)",
    noSegments: "No flight segments detected.",
    leaving: "Departure",
    arriving: "Arrival",
    transit: "Transit time",
    copyRates: "Copy with rates",
  },
};

export function t(lang: Lang): Labels {
  return DICT[lang] ?? DICT.es;
}
