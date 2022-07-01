import {version} from '../package.json';
import { PostHogCore, PosthogCoreOptions } from '../../posthog-core/src';
import { PostHogCoreFetchRequest, PostHogCoreFetchResponse } from '../../posthog-core/src/types';

export interface PostHogNodejsOptions extends PosthogCoreOptions {}

export class PostHogNodejs extends PostHogCore {
  private _cachedDistinctId?: string;

  constructor(apiKey: string, options: PostHogNodejsOptions) {
    super(apiKey, options);
  }

  fetch(req: PostHogCoreFetchRequest): Promise<PostHogCoreFetchResponse> {
    throw Error('not implemten');
  }

  getLibraryId(): string {
    return 'posthog-node';
  }
  getLibraryVersion(): string {
    return version;
  }
  getCustomUserAgent(): string {
    return `posthog-node/${version}`;
  }

  async getDistinctId(): Promise<string> {
    return '';
  }

  async onSetDistinctId(_: string): Promise<string> {
    return _;
  }
}
