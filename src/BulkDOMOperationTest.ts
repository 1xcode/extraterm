/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import sourceMapSupport = require('source-map-support');
import nodeunit = require('nodeunit');
import BulkDOMOperation = require('./BulkDOMOperation');

sourceMapSupport.install();

export function testOne(test: nodeunit.Test): void {
  let wasCalled = false;
  const generator = function* generator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    wasCalled = true;
    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  BulkDOMOperation.execute(BulkDOMOperation.fromGenerator(generator.bind(this)()));

  test.equal(wasCalled, true);
  test.done();
}

export function testTwo(test: nodeunit.Test): void {
  let wasCalled = false;
  let wasCalled2 = false;

  const generator = function* generator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    wasCalled = true;
    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  const generator2 = function* generator2(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    wasCalled2 = true;
    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  BulkDOMOperation.execute(
    BulkDOMOperation.fromArray( [ BulkDOMOperation.fromGenerator(generator.bind(this)()),
                                  BulkDOMOperation.fromGenerator(generator2.bind(this)())
                                ]));

  test.equal(wasCalled, true);
  test.equal(wasCalled2, true);
  test.done();
}

export function testOneSequence(test: nodeunit.Test): void {
  let log = "";

  const generator = function* generator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  BulkDOMOperation.execute(BulkDOMOperation.fromGenerator(generator.bind(this)()));

  test.equal(log, "RWRF");
  test.done();
}

export function testTwoSequence(test: nodeunit.Test): void {
  let log = "";

  const generator = function* generator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  BulkDOMOperation.execute(
    BulkDOMOperation.fromArray( [ BulkDOMOperation.fromGenerator(generator.bind(this)()),
                                  BulkDOMOperation.fromGenerator(generator.bind(this)())
                                ]));

  test.equal(log, "RRWWRRFF");
  test.done();
}

export function testOrdered(test: nodeunit.Test): void {
  let log = "";

  const generator = function* generator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  const generator2 = function* generator2(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  BulkDOMOperation.execute(
    BulkDOMOperation.fromArray( [ BulkDOMOperation.fromGenerator(generator.bind(this)()),
                                  BulkDOMOperation.fromGenerator(generator2.bind(this)())
                                ]));

  test.equal(log, "RWFF");
  test.done();
}

export function testExtraOp(test: nodeunit.Test): void {
  let log = "";

  const childGenerator = function* childGenerator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDOMOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  const generator = function* generator(): IterableIterator<BulkDOMOperation.GeneratorResult> {
    yield BulkDOMOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield { phase: BulkDOMOperation.GeneratorPhase.BEGIN_FINISH, extraOperation: BulkDOMOperation.fromGenerator(childGenerator.bind(this)()) };
    log += "F";

    return BulkDOMOperation.GeneratorPhase.DONE;
  };

  BulkDOMOperation.execute(BulkDOMOperation.fromGenerator(generator.bind(this)()));

  test.equal(log, "WRFF");
  test.done();
}
