import {PostHogCoreFetchRequest, PostHogCoreFetchResponse} from './types';
import {assert, removeTrailingSlash, retriable} from './utils';
import {eventValidation} from './validation';

const setImmediate = global.setImmediate || process.nextTick.bind(process);
const noop = () => {};

const FIVE_MINUTES = 5 * 60 * 1000;

export interface PosthogCoreOptions {
  host?: string;
  timeout?: number;
  flushAt?: number;
  flushInterval?: number;
  personalApiKey?: string;
  enable?: boolean;
}

export abstract class PostHogCore {
  // options
  private apiKey: string;
  private personalApiKey?: string;
  private host: string;
  private timeout?: number;
  private flushAt: number;
  private flushInterval: number;

  // internal
  private _queue: any[];
  private _flushed = false;
  private _timer?: any;

  // Abstract methods to be overridden by implementations
  abstract fetch(
    req: PostHogCoreFetchRequest,
  ): Promise<PostHogCoreFetchResponse>;

  abstract getLibraryId(): string;
  abstract getLibraryVersion(): string;
  abstract getDistinctId(): Promise<string>;
  abstract onSetDistinctId(newDistinctId: string): Promise<string>;

  abstract getCustomUserAgent(): string | void;

  public enabled = true;

  constructor(apiKey: string, options: PosthogCoreOptions = {}) {
    assert(apiKey, "You must pass your PostHog project's api key.");

    this._queue = [];
    this.apiKey = apiKey;
    this.personalApiKey = options.personalApiKey;
    this.host = removeTrailingSlash(options.host || 'https://app.posthog.com');
    this.timeout = options.timeout;
    this.flushAt = options.flushAt ? Math.max(options.flushAt, 1) : 20;
    this.flushInterval = options.flushInterval ?? 10000;
  }

  private async fetchWithRetry(
    req: PostHogCoreFetchRequest,
  ): Promise<PostHogCoreFetchResponse> {
    return retriable(() => this.fetch(req));
  }

  private validate(type: string, message: any) {
    try {
      eventValidation(type, message);
    } catch (e: any) {
      if (e.message === 'Your message must be < 32 kB.') {
        console.log('Your message must be < 32 kB.', JSON.stringify(message));
        return;
      }
      throw e;
    }
  }

  protected getCommonEventProperties(): any {
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion(),
    };
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  /**
   * Send an identify `message`.
   *
   * @param {Object} message
   * @param {Function} [callback] (optional)
   * @return {PostHog}
   */

  async identify(distinctId: string, properties?: any, callback?: () => void) {
    const event = {
      distinctId: distinctId,
      properties: properties,
    };
    this.validate('identify', event);

    const payload = {
      distinct_id: distinctId,
      $set: properties || {},
      event: '$identify',
      properties: {
        ...this.getCommonEventProperties(),
      },
    };

    this.onSetDistinctId(distinctId);

    this.enqueue('identify', payload, callback);
    return this;
  }

  /**
   * Send a capture `message`.
   *
   * @param {Object} message
   * @param {Function} [callback] (optional)
   * @return {PostHog}
   */

  async capture(event: string, properties?: any, callback?: () => void) {
    const distinctId = await this.getDistinctId();

    this.validate('capture', {
      event,
      distinctId,
      properties,
    });

    if ('groups' in properties) {
      properties.$groups = properties.groups;
      delete properties.groups;
    }

    const payload = {
      distinct_id: distinctId,
      event,
      properties: {
        ...properties,
        ...this.getCommonEventProperties(),
      },
    };

    this.enqueue('capture', payload, callback);
    return this;
  }

  /**
   * Send an alias `message`.
   *
   * @param {Object} message
   * @param {Function} [callback] (optional)
   * @return {PostHog}
   */

  async alias(alias: string, callback?: () => void) {
    const distinctId = await this.getDistinctId();

    this.validate('alias', {
      distinctId,
      alias,
    });

    const payload = {
      distinct_id: distinctId,
      event: '$create_alias',
      properties: {
        distinct_id: distinctId,
        alias: alias,
        ...this.getCommonEventProperties(),
      },
    };

    this.enqueue('alias', payload, callback);
    return this;
  }

  /**
   * @description Sets a groups properties, which allows asking questions like "Who are the most active companies"
   * using my product in PostHog.
   *
   * @param groupType Type of group (ex: 'company'). Limited to 5 per project
   * @param groupKey Unique identifier for that type of group (ex: 'id:5')
   * @param properties OPTIONAL | which can be a object with any information you'd like to add
   */
  async groupIdentify(
    group: {groupType: string; groupKey: string},
    properties?: any,
    callback?: () => void,
  ) {
    this.validate('groupIdentify', group);

    const payload = {
      event: '$groupidentify',
      distinctId: `$${group.groupType}_${group.groupKey}`,
      properties: {
        $group_type: group.groupType,
        $group_key: group.groupKey,
        $group_set: properties || {},
      },
    };

    this.enqueue('capture', payload, callback);
    return this;
  }

  // async isFeatureEnabled(key: string, defaultResult = false, groups = {}) {
  //   const distinctId = await this.getDistinctId();
  //   this.validate('isFeatureEnabled', {key, distinctId, defaultResult, groups});
  //   assert(
  //     this.personalApiKey,
  //     'You have to specify the option personalApiKey to use feature flags.',
  //   );

  //   return await this.featureFlagsPoller.isFeatureEnabled(
  //     key,
  //     distinctId,
  //     defaultResult,
  //     groups,
  //   );
  // }

  // async reloadFeatureFlags() {
  //   await this.featureFlagsPoller.loadFeatureFlags(true);
  // }

  /**
   * Add a `message` of type `type` to the queue and
   * check whether it should be flushed.
   *
   * @param {String} type
   * @param {Object} payload
   * @param {Function} [callback] (optional)
   * @api private
   */

  enqueue(type: string, _message: any, callback?: () => void) {
    console.log('queueing', type, _message);
    callback = callback || noop;

    if (!this.enabled) {
      return setImmediate(callback);
    }

    const message = {
      ..._message,
      type: type,
      library: this.getLibraryId(),
      library_version: this.getLibraryVersion(),
      timestamp: _message.timestamp ? _message.timestamp : new Date(),
    };

    if (message.distinctId) {
      message.distinct_id = message.distinctId;
      delete message.distinctId;
    }

    this._queue.push({message, callback});

    // Flush first event no matter what
    if (!this._flushed) {
      this._flushed = true;
      this.flush();
      return;
    }

    // Flush queued events if we meet the flushAt length
    if (this._queue.length >= this.flushAt) {
      this.flush();
    }

    if (this.flushInterval && !this._timer) {
      this._timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Flush the current queue
   *
   * @param {Function} [callback] (optional)
   * @return {PostHog}
   */

  flush(callback?: (err?: any, data?: any) => void) {
    console.log('flushing!', this._queue, this.enabled);

    callback = callback || noop;

    if (!this.enabled) {
      return setImmediate(callback);
    }

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    if (!this._queue.length) {
      return setImmediate(callback);
    }

    const items = this._queue.splice(0, this.flushAt);
    const callbacks = items.map(item => item.callback);
    const messages = items.map(item => item.message);

    const data = {
      api_key: this.apiKey,
      batch: messages,
    };

    const done = (err?: any) => {
      callbacks.forEach(cb => cb(err));
      callback?.(err, data);
    };

    // Don't set the user agent if we're not on a browser. The latest spec allows
    // the User-Agent header (see https://fetch.spec.whatwg.org/#terminology-headers
    // and https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader),
    // but browsers such as Chrome and Safari have not caught up.
    const customUserAgent = this.getCustomUserAgent();
    const headers: {[key: string]: string} = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (customUserAgent) {
      headers['user-agent'] = customUserAgent;
    }

    const req: PostHogCoreFetchRequest = {
      method: 'POST',
      url: `${this.host}/batch/`,
      data,
      headers,
      timeout: this.timeout,
    };

    this.fetchWithRetry(req)
      .then(() => done())
      .catch(err => {
        console.log(err);
        if (err.response) {
          const error = new Error(err.response.statusText);
          return done(error);
        }

        done(err);
      });
  }

  shutdown() {
    // if (this.personalApiKey) {
    //   this.featureFlagsPoller.stopPoller();
    // }
    this.flush();
  }

  // _isErrorRetriable(error) {
  //   // Retry Network Errors.
  //   if (axiosRetry.isNetworkError(error)) {
  //     return true;
  //   }

  //   if (!error.response) {
  //     // Cannot determine if the request can be retried
  //     return false;
  //   }

  //   // Retry Server Errors (5xx).
  //   if (error.response.status >= 500 && error.response.status <= 599) {
  //     return true;
  //   }

  //   // Retry if rate limited.
  //   if (error.response.status === 429) {
  //     return true;
  //   }

  //   return false;
  // }
}


export { PostHogCoreFetchRequest, PostHogCoreFetchResponse} from './types'