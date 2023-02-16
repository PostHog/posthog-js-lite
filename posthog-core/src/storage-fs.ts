import fs from 'fs';
import { PostHogPersistedProperty } from './types'

export class PostHogFsStorage {
  private _storageFile: string;
  private _memoryStorage: Record<string, any | undefined>;

  constructor(storage_file: string) {
    this._storageFile = storage_file;
    if (fs.existsSync(this._storageFile)) {
      const rawProperties = fs.readFileSync(this._storageFile, 'utf-8');
      this._memoryStorage = JSON.parse(rawProperties);
    } else {
      this._memoryStorage = {};
    }
  }

  getProperty(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage[key];
  }

  setProperty(key: PostHogPersistedProperty, value: any | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined;
    const rawProperties = JSON.stringify(this._memoryStorage);
    fs.writeFileSync(this._storageFile, rawProperties);
  }
}
