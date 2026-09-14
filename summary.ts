import { Collector } from "./collector.ts";
import { type Labels, Metric, type Observe } from "./metric.ts";
import type { Registry } from "./registry.ts";

class Sample {
  private timestamp: number;
  private value: number;

  constructor(value: number) {
    this.timestamp = new Date().getTime();
    this.value = value;
  }

  getTimestamp(): number {
    return this.timestamp;
  }

  getValue(): number {
    return this.value;
  }
}

/**
 * A summary tracks observations and exposes configurable quantiles over a
 * sliding window, plus their sum and count.
 *
 * @example
 * ```ts
 * const summary = Summary.with({
 *   name: "http_request_duration_seconds",
 *   help: "Request duration in seconds.",
 *   quantiles: [0.5, 0.9, 0.99],
 *   maxAge: 60_000,
 * });
 * summary.observe(0.3);
 * ```
 */
export class Summary extends Metric implements Observe {
  private collector: Collector;
  private quantiles: number[];
  private values: Sample[];
  private maxAge?: number;
  private ageBuckets?: number;

  /**
   * Creates the metric and registers it with the given registries (the
   * default registry when none is given).
   *
   * @param config.name Metric name, e.g. `http_requests_total`.
   * @param config.help Help text shown in the `# HELP` line.
   * @param config.labels Label names the metric can be partitioned by.
   * @param config.registry Registries to register with, default `[Registry.default]`.
   * @param config.quantiles Quantiles in `[0, 1]` to expose, default `[.01, .05, .5, .95, .99]`.
   * @param config.maxAge Drop observations older than this many milliseconds.
   * @param config.ageBuckets Keep at most this many of the newest observations.
   */
  static with(
    config: {
      name: string;
      help: string;
      labels?: string[];
      quantiles?: number[];
      maxAge?: number;
      ageBuckets?: number;
      registry?: Registry[];
    },
  ): Summary {
    const collector = new Collector(
      config.name,
      config.help,
      "summary",
      config.registry,
    );

    const labels = config.labels || [];
    const quantiles = config.quantiles || [.01, .05, .5, .95, .99];

    return new Summary(
      collector,
      labels,
      quantiles,
      config.maxAge,
      config.ageBuckets,
    );
  }

  private constructor(
    collector: Collector,
    labels: string[],
    quantiles: number[],
    maxAge?: number,
    ageBuckets?: number,
  ) {
    super(labels, new Array(labels.length).fill(undefined));
    this.collector = collector;
    this.quantiles = quantiles.sort((a, b) => a < b ? -1 : 1);
    this.values = [];
    this.maxAge = maxAge;
    this.ageBuckets = ageBuckets;
    this.collector.getOrSetMetric(this);

    quantiles.forEach((v) => {
      if (v < 0 || v > 1) {
        throw new Error(`invalid quantiles: ${v} not in [0,1]`);
      }
    });
  }

  /** Metric name plus rendered labels. */
  get description(): string {
    const labels = this.getLabelsAsString();
    return `${this.collector.name}${labels}`;
  }

  /** Drops observations outside the `maxAge` / `ageBuckets` window. */
  private clean(): void {
    // Remove older than maxAge
    if (this.maxAge !== undefined) {
      const limit = new Date().getTime() - this.maxAge;
      let i = 0;
      while (i < this.values.length) {
        if (this.values[i].getTimestamp() > limit) {
          break;
        }
        i++;
      }
      this.values = this.values.slice(i);
    }

    // Remove extra values
    if (this.ageBuckets !== undefined) {
      const index = this.values.length - this.ageBuckets;
      this.values = this.values.splice(index);
    }
  }

  /** Quantile, sum and count lines, or `undefined` while nothing was observed. */
  expose(): string | undefined {
    if (this.values.length === 0) {
      return undefined;
    }

    let text = "";

    this.clean();
    const sorted = this.values.slice().sort((a, b) =>
      a.getValue() - b.getValue()
    );

    for (const p of this.quantiles) {
      const labels = this.getLabelsAsString({ quantile: p.toString() });
      let index = Math.ceil(p * sorted.length);
      index = index == 0 ? 0 : index - 1;
      const value = sorted[index].getValue();
      text += `${this.collector.name}${labels} ${value}\n`;
    }

    const labels = this.getLabelsAsString();
    const sum = this.values.reduce((sum, v) => sum + v.getValue(), 0);
    text += `${this.collector.name}_sum${labels} ${sum}\n`;
    text += `${this.collector.name}_count${labels} ${sorted.length}`;

    return text;
  }

  /**
   * Returns the child summary for the given label values.
   *
   * @throws if a label name was not declared in `Summary.with`.
   */
  labels(labels: Labels): Observe {
    let child = new Summary(this.collector, this.labelNames, this.quantiles);

    for (const key of Object.keys(labels)) {
      const index = child.labelNames.indexOf(key);
      if (index === -1) {
        throw new Error(`label with name ${key} not defined`);
      }
      child.labelValues[index] = labels[key];
    }

    child = child.collector.getOrSetMetric(child) as Summary;

    return {
      observe: (n) => {
        child.observe(n);
      },
    };
  }

  /** Records the observation `n`. */
  observe(n: number): void {
    this.values.push(new Sample(n));
  }

  /** Number of observations inside the window. */
  getCount(): number {
    this.clean();
    return this.values.length;
  }

  /** Sum of the observations inside the window. */
  getSum(): number {
    this.clean();
    return this.values.reduce((sum, v) => sum + v.getValue(), 0);
  }

  /** The observed values inside the window, in insertion order. */
  getValues(): number[] {
    this.clean();
    return this.values.map((s) => s.getValue());
  }
}
