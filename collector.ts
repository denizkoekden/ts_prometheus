import type { Metric } from "./metric.ts";
import { Registry } from "./registry.ts";

/**
 * Groups all label combinations of one metric under a shared name, help text
 * and type. Created internally by the metric classes.
 */
export class Collector {
  private _name: string;
  private _help: string;
  private _type: string;
  private metrics: Map<string, Metric>;
  private registries: Registry[];

  /**
   * Creates a collector and registers it with `registries` (the default
   * registry when omitted).
   *
   * @throws if `name` is not a valid metric name.
   */
  constructor(
    name: string,
    help: string,
    type: string,
    registries?: Registry[],
  ) {
    if (!isValidMetricName(name)) {
      throw new Error("invalid metric name");
    }

    this._name = name;
    this._help = escapeHelpString(help);
    this._type = type;
    this.metrics = new Map();
    this.registries = registries || [Registry.default];
    this.registries.forEach((registry) => registry.register(this));
  }

  /** The metric name. */
  get name(): string {
    return this._name;
  }

  /** The escaped help text. */
  get help(): string {
    return this._help;
  }

  /** The Prometheus metric type, e.g. `counter`. */
  get type(): string {
    return this._type;
  }

  /** All metrics (label combinations) of this collector. */
  collect(): Metric[] {
    return [...this.metrics.values()];
  }

  /** Returns the stored metric with the same description, storing `metric` if none exists. */
  getOrSetMetric(metric: Metric): Metric {
    const saved = this.metrics.get(metric.description);
    if (saved !== undefined) {
      return saved;
    }
    this.metrics.set(metric.description, metric);
    return metric;
  }
}

/** Whether `name` is a valid Prometheus metric name. */
export function isValidMetricName(name: string): boolean {
  return /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name);
}

/** Escapes backslashes and newlines for use in a `# HELP` line. */
export function escapeHelpString(help: string): string {
  return help
    .replace(/\\/g, "\\\\") // backslash
    .replace(/\n/g, "\\\n"); // new line
}
