/**
 * A Prometheus client for Deno, Node.js, Bun and browsers.
 *
 * Provides the four Prometheus metric types (counter, gauge, histogram and
 * summary) and a {@linkcode Registry} that renders them in the Prometheus
 * text exposition format.
 *
 * @example
 * ```ts
 * import { Counter, Registry } from "@denizkoekden/ts-prometheus";
 *
 * const requests = Counter.with({
 *   name: "http_requests_total",
 *   help: "The total number of HTTP requests.",
 *   labels: ["method", "status"],
 * });
 *
 * requests.labels({ method: "GET", status: "200" }).inc();
 *
 * console.log(Registry.default.metrics());
 * ```
 *
 * @module
 */
export { Counter } from "./counter.ts";
export { Gauge } from "./gauge.ts";
export { Histogram } from "./histogram.ts";
export { Summary } from "./summary.ts";
export type {
  Dec,
  Inc,
  Labels,
  Metric,
  Observe,
  Set,
  Value,
} from "./metric.ts";
export type { Collector } from "./collector.ts";
export { Registry } from "./registry.ts";
