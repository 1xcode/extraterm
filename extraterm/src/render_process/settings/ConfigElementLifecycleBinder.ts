/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Disposable, Event } from 'extraterm-extension-api';
import { ConfigKey, ConfigDatabase, ConfigChangeEvent } from '../../Config';

/**
 * Binds the handling of a ConfigDatabase with the lifecycle of an HTML
 * custom element. It connects and disconnects to the onChange event as
 * the element is added and removed from the DOM. This is important to
 * avoid memory leaks where registered event handlers can keep the main
 * object alive.
 * 
 * The an onChange event is triggered, or when the element is connected to
 * the DOM, then the function passed to the constructor will be called.
 * 
 * To use this properly be sure to call the `connecteCallback()` and
 * `disconnectedCallback()` methods from the matching methods in your
 * custom element.
 */
export class ConfigElementLifecycleBinder {

  private _connected = false;
  private _configDatabase: ConfigDatabase = null;
  private _onChangeDisposable: Disposable = null;

  constructor(private _onChangeCallback: (key: ConfigKey, newConfig: any) => void, private _keys: ConfigKey[]) {
  }

  setConfigDatabase(configDatabase: ConfigDatabase): void {
    if (this._configDatabase === configDatabase) {
      return;
    }

    this._stopHandle();
    this._configDatabase = configDatabase;

    if (this._connected) {
      this._onChangeDisposable = this._configDatabase.onChange((event: ConfigChangeEvent): void => this._onChangeCallback(event.key, event.newConfig));

      this._broadcastAllConfigs();
    }
  }

  private _broadcastAllConfigs(): void {
    if (this._configDatabase != null) {
      for (const key of this._keys) {
        const config = this._configDatabase.getConfig(key);
        this._onChangeCallback(key, config);
      }
    }
  }

  getConfigDatabase(): ConfigDatabase {
    return this._configDatabase;
  }

  private _stopHandle(): void {
    if (this._onChangeDisposable != null) {
      this._onChangeDisposable.dispose();
      this._onChangeDisposable = null;
    }
  }

  connectedCallback(): void {
    if (this._configDatabase != null) {
      this._onChangeDisposable = this._configDatabase.onChange((event: ConfigChangeEvent): void => this._onChangeCallback(event.key, event.newConfig));
    }
    this._connected = true;
    this._broadcastAllConfigs();
  }

  disconnectedCallback(): void {
    this._stopHandle();
    this._connected = false;
  }
}
