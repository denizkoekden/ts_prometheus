/** A map of label name to label value. */
export type Labels = { [key: string]: string };
/**
 * Base class of every metric. Holds the label names and values and knows how
 * to render them in the exposition format.
 */
export abstract class Metric {
  /** Declared label names, in order. */
  protected labelNames: string[];
  /** Label values matching `labelNames`; `undefined` entries are unset. */
  protected labelValues: string[];

  /**
   * Creates a metric with the given label names and values.
   *
   * @param labelNames Declared label names.
   * @param labelValues Values matching `labelNames`, same length.
   * @throws if the lengths differ or a label name is invalid.
   */
  constructor(
    labelNames: string[] = [],
    labelValues: string[] = [],
  ) {
    if (labelNames.length !== labelValues.length) {
      throw new Error("invalid number of arguments");
    }
    for (const label of labelNames) {
      if (!isValidLabelName(label)) {
        throw new Error(`invalid label name: ${label}`);
      }
    }
    this.labelNames = labelNames;
    this.labelValues = labelValues;
  }

  /**
   * Renders the metric labels, plus any extra `labels`, as the `{a="b",c="d"}`
   * suffix used in the exposition format. Returns an empty string when there
   * are no labels.
   */
  getLabelsAsString(labels: Labels = {}): string {
    let labelsAsString = "";
    for (let i = 0; i < this.labelNames.length; i++) {
      if (this.labelValues[i]) {
        labelsAsString += `${this.labelNames[i]}="${this.labelValues[i]}",`;
      }
    }
    for (const labelName of Object.keys(labels)) {
      labelsAsString += `${labelName}="${labels[labelName]}",`;
    }
    if (labelsAsString !== "") {
      labelsAsString = `{${labelsAsString.slice(0, -1)}}`;
    }
    return labelsAsString;
  }

  /** Unique identifier of this metric within its collector. */
  abstract get description(): string;
  /** Exposition text of this metric, or `undefined` when nothing was recorded. */
  abstract expose(): string | undefined;
}

/** Whether `label` is a valid Prometheus label name. */
export function isValidLabelName(label: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label);
}
/** A metric that can be incremented. */
export interface Inc {
  /** Increments by 1. */
  inc(): void;
  /** Increments by `n`. */
  inc(n: number): void;
}

/** A metric that can be decremented. */
export interface Dec {
  /** Decrements by 1. */
  dec(): void;
  /** Decrements by `n`. */
  dec(n: number): void;
}

/** A metric whose value can be set directly. */
export interface Set {
  /** Sets the value to `n`. */
  set(n: number): void;
}

/** A metric that records observations. */
export interface Observe {
  /** Records the observation `n`. */
  observe(n: number): void;
}

/** A metric whose current value can be read. */
export interface Value {
  /** The current value, or `undefined` when nothing was recorded yet. */
  value(): number | undefined;
}
