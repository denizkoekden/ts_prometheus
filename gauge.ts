import { Collector } from "./collector.ts";
import {
  type Dec,
  type Inc,
  type Labels,
  Metric,
  type Set,
  type Value,
} from "./metric.ts";
import type { Registry } from "./registry.ts";

/**
 * A gauge is a metric whose value can go up and down, or be set directly.
 *
 * @example
 * ```ts
 * const gauge = Gauge.with({
 *   name: "temperature_celsius",
 *   help: "The current temperature.",
 * });
 * gauge.set(21.5);
 * gauge.dec(0.5);
 * ```
 */
export class Gauge extends Metric implements Inc, Dec, Value {
  private collector: Collector;
  private _value?: number;

  /**
   * Creates the metric and registers it with the given registries (the
   * default registry when none is given).
   *
   * @param config.name Metric name, e.g. `http_requests_total`.
   * @param config.help Help text shown in the `# HELP` line.
   * @param config.labels Label names the metric can be partitioned by.
   * @param config.registry Registries to register with, default `[Registry.default]`.
   */
  static with(
    config: {
      name: string;
      help: string;
      labels?: string[];
      registry?: Registry[];
    },
  ): Gauge {
    const collector = new Collector(
      config.name,
      config.help,
      "gauge",
      config.registry,
    );
    const labels = config.labels || [];
    return new Gauge(collector, labels);
  }

  private constructor(
    collector: Collector,
    labels: string[] = [],
  ) {
    super(labels, new Array(labels.length).fill(undefined));
    this.collector = collector;
    this._value = undefined;
    this.collector.getOrSetMetric(this);
  }

  /** Metric name plus rendered labels. */
  get description(): string {
    const labels = this.getLabelsAsString();
    return `${this.collector.name}${labels}`;
  }

  /** Exposition line, or `undefined` while no value was recorded. */
  expose(): string | undefined {
    if (this._value !== undefined) {
      return `${this.description} ${this._value}`;
    }
    return undefined;
  }

  /**
   * Returns the child gauge for the given label values.
   *
   * @throws if a label name was not declared in `Gauge.with`.
   */
  labels(labels: Labels): Inc & Dec & Set & Value {
    let child = new Gauge(this.collector, this.labelNames);
    for (const key of Object.keys(labels)) {
      const index = child.labelNames.indexOf(key);
      if (index === -1) {
        throw new Error(`label with name ${key} not defined`);
      }
      child.labelValues[index] = labels[key];
    }
    child = child.collector.getOrSetMetric(child) as Gauge;

    return {
      // deno-lint-ignore no-inferrable-types
      inc: (n: number = 1) => {
        child.inc(n);
      },
      // deno-lint-ignore no-inferrable-types
      dec: (n: number = 1) => {
        child.dec(n);
      },
      set: (n: number) => {
        child.set(n);
      },
      value: () => {
        return child._value;
      },
    };
  }
  /** Increments the gauge by `n` (default 1). */
  // deno-lint-ignore no-inferrable-types
  inc(n: number = 1): void {
    if (this._value === undefined) {
      this._value = 0;
    }
    this._value += n;
  }
  /** Decrements the gauge by `n` (default 1). */
  // deno-lint-ignore no-inferrable-types
  dec(n: number = 1): void {
    if (this._value === undefined) {
      this._value = 0;
    }
    this._value -= n;
  }

  /** Sets the gauge to `n`. */
  set(n: number): void {
    this._value = n;
  }

  /** The current value, or `undefined` while no value was recorded. */
  value(): number | undefined {
    return this._value;
  }
}
