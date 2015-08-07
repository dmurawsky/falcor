var falcor = require("./../../../lib/");
var Model = falcor.Model;
var Cache = require('../../data/Cache');
var Expected = require('../../data/expected');
var Rx = require('rx');
var getTestRunner = require('./../../getTestRunner');
var testRunner = require('./../../testRunner');
var noOp = function() {};
var LocalDataSource = require('../../data/LocalDataSource');
var ErrorDataSource = require('../../data/ErrorDataSource');
var isPathValue = require("./../../../lib/support/is-path-value");
var expect = require("chai").expect;
var sinon = require('sinon');

describe('DataSource Only', function() {
    describe('Preload Functions', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: new LocalDataSource(Cache())});
            var expected = Expected.Values().direct.AsPathMap.values[0];
            var onNext = sinon.spy();
            var secondOnNext = sinon.spy();
            model.
                preload(['videos', 1234, 'summary']).
                doAction(onNext).
                doAction(noOp, noOp, function() {
                    expect(onNext.callCount).to.equal(0);
                }).
                defaultIfEmpty({}).
                flatMap(function() {
                    return model.get(['videos', 1234, 'summary']);
                }).
                doAction(secondOnNext).
                doAction(noOp, noOp, function() {
                    expect(secondOnNext.calledOnce).to.be.ok;
                    testRunner.compare(expected, secondOnNext.getCall(0).args[0]);
                }).
                subscribe(noOp, done, done);
        });

        it('should perform multiple trips to a dataSource.', function(done) {
            var get = sinon.spy(function(source, paths) {
                if (paths.length === 0) {
                    paths.pop();
                }
            });
            var model = new Model({
                source: new LocalDataSource(Cache(), {onGet: get})
            });
            var expected = Expected.Values().direct.AsPathMap.values[0];
            var onNext = sinon.spy();
            var secondOnNext = sinon.spy();
            model.
                preload(['videos', 1234, 'summary'],
                    ['videos', 3355, 'art']).
                doAction(onNext).
                doAction(noOp, noOp, function() {
                    expect(onNext.callCount).to.equal(0);
                }).
                defaultIfEmpty({}).
                flatMap(function() {
                    return model.get(['videos', 1234, 'summary']);
                }).
                doAction(secondOnNext).
                doAction(noOp, noOp, function() {
                    expect(secondOnNext.calledOnce).to.be.ok;
                    testRunner.compare(expected, secondOnNext.getCall(0).args[0]);
                }).
                subscribe(noOp, done, done);
        });
    });
    describe('toJSON', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: new LocalDataSource(Cache())});
            var expected = Expected.Values().direct.AsPathMap.values[0];
            var next = false;
            model.
                get(['videos', 1234, 'summary']).
                toJSON().
                doAction(function(x) {
                    testRunner.compare(expected, x);
                    next = true;
                }, noOp, function() {
                    testRunner.compare(true, next, 'Expect to be onNext at least 1 time.');
                }).
                subscribe(noOp, done, done);
        });
    });
    describe('toJSONG', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: new LocalDataSource(Cache())});
            var expected = Expected.Values().direct.AsJSONG.values[0];
            var next = false;
            model.
                get(['videos', 1234, 'summary']).
                toJSONG().
                doAction(function(x) {
                    testRunner.compare(expected, x);
                    next = true;
                }, noOp, function() {
                    testRunner.compare(true, next, 'Expect to be onNext at least 1 time.');
                }).
                subscribe(noOp, done, done);
        });
    });
    describe('toPathValues', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: new LocalDataSource(Cache())});
            var expected = Expected.Values().direct.AsValues.values[0];
            var next = 0;
            model.
                get(['videos', 1234, 'summary']).
                toPathValues().
                doAction(function(x) {
                    testRunner.compare(expected, x);
                    ++next;
                }, noOp, function() {
                    testRunner.compare(1, next, 'Expect to be onNext 1 time.');
                }).
                subscribe(noOp, done, done);
        });
    });
    it('should report errors from a dataSource.', function(done) {
        var model = new Model({
            source: new ErrorDataSource(500, 'Oops!')
        });
        model.
            get(['videos', 1234, 'summary']).
            doAction(noOp, function(err) {
                testRunner.compare([{
                    path: ['videos', 1234, 'summary'],
                    value: {
                        message: 'Oops!',
                        status: 500
                    }
                }], err);
            }).
            subscribe(noOp, function(err) {
                // ensure its the same error
                if (Array.isArray(err) && isPathValue(err[0])) {
                    done();
                } else {
                    done(err);
                }
            }, function() {
                done('On Completed was called. ' +
                     'OnError should have been called.');
            });
    });
    it("should get all missing paths in a single request", function(done) {
        var serviceCalls = 0;
        var cacheModel = new Model({
            cache: {
                lolomo: {
                    summary: {
                        $type: "atom",
                        value: "hello"
                    },
                    0: {
                        summary: {
                            $type: "atom",
                            value: "hello-0"
                        }
                    },
                    1: {
                        summary: {
                            $type: "atom",
                            value: "hello-1"
                        }
                    },
                    2: {
                        summary: {
                            $type: "atom",
                            value: "hello-2"
                        }
                    }
                }
            }
        });
        var model = new Model({ source: {
            get: function(paths) {
                serviceCalls++;
                return cacheModel.get.apply(cacheModel, paths).toJSONG();
            }
        }});


        var onNext = sinon.spy();
        model.
            get("lolomo.summary", "lolomo[0..2].summary").
            doAction(onNext).
            doAction(noOp, noOp, function() {
                var data = onNext.getCall(0).args[0];
                var json = data.json;
                var lolomo = json.lolomo;
                expect(lolomo.summary).to.be.ok;
                expect(lolomo[0].summary).to.be.ok;
                expect(lolomo[1].summary).to.be.ok;
                expect(lolomo[2].summary).to.be.ok;
                expect(serviceCalls).to.equal(1);
            }).
            subscribe(noOp, done, done);
    });
});

