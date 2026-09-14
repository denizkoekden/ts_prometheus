import { Collector } from "./collector.ts";
import { type Inc, type Labels, Metric, type Value } from "./metric.ts";
import type { Registry } from "./registry.ts";
/**
 * A counter is a cumulative metric whose value only ever increases.
 *
 * @example
 * ```ts
 * const counter = Counter.with({
 *   name: "http_requests_total",
 *   help: "The total number of HTTP requests.",
 *   labels: ["method", "status"],
 * });
 * counter.labels({ method: "GET", status: "200" }).inc();
 * ```
 */
export class Counter extends Metric implements Inc, Value {
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
  ): Counter {
    const collector = new Collector(
      config.name,
      config.help,
      "counter",
      config.registry,
    );
    const labels = config.labels || [];
    return new Counter(collector, labels);
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

  /** Exposition line, or `undefined` while nothing was counted. */
  expose(): string | undefined {
    if (this._value !== undefined) {
      return `${this.description} ${this._value}`;
    }
    return undefined;
  }

  /**
   * Returns the child counter for the given label values.
   *
   * @throws if a label name was not declared in `Counter.with`.
   */
  labels(labels: Labels): Inc & Value {
    let child = new Counter(this.collector, this.labelNames);
    for (const key of Object.keys(labels)) {
      const index = child.labelNames.indexOf(key);
      if (index === -1) {
        throw new Error(`label with name ${key} not defined`);
      }
      child.labelValues[index] = labels[key];
    }
    child = child.collector.getOrSetMetric(child) as Counter;

    return {
      // deno-lint-ignore no-inferrable-types
      inc: (n: number = 1) => {
        child.inc(n);
      },
      value: () => {
        return child._value;
      },
    };
  }
  /**
   * Increments the counter by `n` (default 1).
   *
   * @throws if `n` is negative.
   */
  // deno-lint-ignore no-inferrable-types
  inc(n: number = 1): void {
    if (n < 0) {
      throw new Error("it is not possible to deacrease a counter");
    }
    if (this._value === undefined) {
      this._value = 0;
    }
    this._value += n;
  }

  /** The current value, or `undefined` while nothing was counted. */
  value(): number | undefined {
    return this._value;
  }
}
