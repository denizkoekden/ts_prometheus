import { Collector } from "./collector.ts";
import { type Labels, Metric, type Observe } from "./metric.ts";
import type { Registry } from "./registry.ts";

/**
 * A histogram counts observations into configurable buckets and tracks their
 * sum and count.
 *
 * @example
 * ```ts
 * const histogram = Histogram.with({
 *   name: "http_request_duration_seconds",
 *   help: "Request duration in seconds.",
 *   buckets: [0.1, 0.5, 1, 5],
 * });
 * histogram.observe(0.3);
 * ```
 */
export class Histogram extends Metric implements Observe {
  private collector: Collector;
  private buckets: number[];
  private count: number;
  private sum: number;
  private values: number[];

  /**
   * Creates the metric and registers it with the given registries (the
   * default registry when none is given).
   *
   * @param config.name Metric name, e.g. `http_requests_total`.
   * @param config.help Help text shown in the `# HELP` line.
   * @param config.labels Label names the metric can be partitioned by.
   * @param config.registry Registries to register with, default `[Registry.default]`.
   * @param config.buckets Upper bounds of the buckets; a `+Inf` bucket is added automatically.
   */
  static with(
    config: {
      name: string;
      help: string;
      labels?: string[];
      buckets: number[];
      registry?: Registry[];
    },
  ): Histogram {
    const collector = new Collector(
      config.name,
      config.help,
      "histogram",
      config.registry,
    );

    const labels = config.labels || [];
    const buckets = config.buckets || [];
    buckets.push(Infinity);

    return new Histogram(collector, labels, buckets);
  }

  private constructor(
    collector: Collector,
    labels: string[],
    buckets: number[],
  ) {
    super(labels, new Array(labels.length).fill(undefined));
    this.collector = collector;
    this.buckets = buckets.sort((a, b) => a < b ? -1 : 1);
    this.count = 0;
    this.sum = 0;
    this.values = new Array(this.buckets.length).fill(0);
    this.collector.getOrSetMetric(this);
  }

  /** Metric name plus rendered labels. */
  get description(): string {
    const labels = this.getLabelsAsString();
    return `${this.collector.name}${labels}`;
  }

  /** Bucket, sum and count lines, or `undefined` while nothing was observed. */
  expose(): string | undefined {
    if (this.count == 0) {
      return undefined;
    }

    let text = "";

    for (let i = 0; i < this.buckets.length; i++) {
      let labels = this.getLabelsAsString({ le: `${this.buckets[i]}` });
      labels = labels.replace("Infinity", "+Inf");
      text += `${this.collector.name}_bucket${labels} ${this.values[i]}\n`;
    }

    const labels = this.getLabelsAsString();
    text += `${this.collector.name}_sum${labels} ${this.sum}\n`;
    text += `${this.collector.name}_count${labels} ${this.count}`;
    return text;
  }

  /**
   * Returns the child histogram for the given label values.
   *
   * @throws if a label name was not declared in `Histogram.with`.
   */
  labels(labels: Labels): Observe {
    let child = new Histogram(this.collector, this.labelNames, this.buckets);

    for (const key of Object.keys(labels)) {
      const index = child.labelNames.indexOf(key);
      if (index === -1) {
        throw new Error(`label with name ${key} not defined`);
      }
      child.labelValues[index] = labels[key];
    }

    child = child.collector.getOrSetMetric(child) as Histogram;

    return {
      observe: (n) => {
        child.observe(n);
      },
    };
  }

  /** Records the observation `n`. */
  observe(n: number): void {
    const index = this.buckets.findIndex((v) => v >= n);

    for (let i = index; i < this.values.length; i++) {
      this.values[i] += 1;
    }

    this.sum += n;
    this.count += 1;
  }
}
