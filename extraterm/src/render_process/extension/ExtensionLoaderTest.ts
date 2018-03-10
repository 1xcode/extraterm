/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import * as path from 'path';
import {ExtensionLoader} from './ExtensionLoader';

export function testHelloWorld(test: nodeunit.Test): void {
  const loader = new ExtensionLoader([path.join(__dirname, "../../test/extensions")]);
  loader.scan();

  const extensions = loader.getExtensionMetadata();

  test.ok(extensions.length >= 1, "Found extensions");

  const helloWorldList = extensions.filter(extension => extension.name === "helloworld");
  test.equal(helloWorldList.length, 1);
  test.equal(helloWorldList[0].main, "main.js");
  test.equal(helloWorldList[0].version, "1.0.0");

  test.ok(loader.load(helloWorldList[0]), "Load module");
  const helloWorldModule = helloWorldList[0].module;

  const context = {activated: false};
  helloWorldModule.activate(context);
  test.equal(context.activated, true);
  test.done();
}

export function testHelloDependency(test: nodeunit.Test): void {
  const loader = new ExtensionLoader([path.join(__dirname, "../../test/extensions")]);
  loader.scan();

  const extensions = loader.getExtensionMetadata();

  test.ok(extensions.length >= 1, "Found extensions");

  const helloDependencyList = extensions.filter(extension => extension.name === "hellodependency");
  test.equal(helloDependencyList.length, 1);

  test.ok(loader.load(helloDependencyList[0]), "Load module");
  const helloDependencyModule = helloDependencyList[0].module;

  const context = {activated: false};
  helloDependencyModule.activate(context);

  test.equal(context.activated, true);
  test.done();
}
