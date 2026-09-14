import type { Collector } from "./collector.ts";

/**
 * Holds a set of collectors and renders their metrics in the Prometheus text
 * exposition format.
 *
 * Metrics register with {@linkcode Registry.default} unless a `registry`
 * option is given when creating them.
 *
 * @example
 * ```ts
 * const registry = new Registry();
 * const counter = Counter.with({
 *   name: "my_counter",
 *   help: "a counter with a custom registry",
 *   registry: [registry],
 * });
 * counter.inc();
 * console.log(registry.metrics());
 * ```
 */
export class Registry {
  /** The default registry every metric registers with unless told otherwise. */
  static default: Registry = new Registry();

  private collectors: Map<string, Collector>;

  constructor() {
    this.collectors = new Map();
  }

  /**
   * Registers a collector.
   *
   * @throws if a collector with the same name is already registered.
   */
  register(collector: Collector): void {
    const found = this.collectors.has(collector.name);
    if (found) {
      throw new Error(
        `a collector with name ${collector.name} has been registered`,
      );
    }
    this.collectors.set(collector.name, collector);
  }

  /** Removes a collector. Unknown collectors are ignored. */
  unregister(collector: Collector): void {
    this.collectors.delete(collector.name);
  }

  /** Removes every collector. */
  clear(): void {
    this.collectors = new Map();
  }

  /**
   * Renders all registered metrics in the Prometheus text exposition format.
   * Metrics without any recorded value are omitted.
   */
  metrics(): string {
    let text = "";
    for (const [_, collector] of this.collectors) {
      let collectorText =
        `# HELP ${collector.name} ${collector.help}\n# TYPE ${collector.name} ${collector.type}\n`;

      let count = 0;
      for (const metric of collector.collect()) {
        const metricText = metric.expose();
        if (metricText !== undefined) {
          collectorText += metricText + "\n";
          count++;
        }
      }

      if (count > 0) {
        text += collectorText + "\n";
      }
    }
    text = text.slice(0, -1); // remove last new line
    return text;
  }
}
