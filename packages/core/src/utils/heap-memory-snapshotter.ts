import { writeHeapSnapshot } from 'v8';

import { StrykerOptions } from '@stryker-mutator/api/core';
import type { Disposable } from 'typed-inject';
import { Logger } from '@stryker-mutator/api/logging';
import { commonTokens } from '@stryker-mutator/api/plugin';

export class HeapMemoryDumper implements Disposable {
  private readonly timer?: NodeJS.Timer;
  private count = 0;

  public static inject = [commonTokens.options, commonTokens.logger] as const;

  constructor(options: StrykerOptions, private readonly log: Logger) {
    if (options.heapSnapshotsInterval > 0) {
      this.timer = setInterval(() => this.dump(), 1000 * options.heapSnapshotsInterval);
    }
  }

  private dump() {
    this.log.info(`Written memory dump file ${++this.count}: ${writeHeapSnapshot()}`);
  }
  public dispose(): void {
    clearInterval(this.timer);
  }
}
