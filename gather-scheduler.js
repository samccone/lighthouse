/**
 * @license
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

class GatherScheduler {

  static runSeries(fns) {
    const args = Array.from(arguments).slice(1);

    return fns.reduce((prev, curr) => {
      return prev.then(_ => curr(...args));
    }, Promise.resolve());
  }

  static loadPage(driver, gatherers, options) {
    const loadPage = options.flags.loadPage;
    const url = options.url;

    if (loadPage) {
      return driver.gotoURL(url, driver.WAIT_FOR_LOADED);
    }

    return Promise.resolve();
  }

  static reloadPage(driver, options) {
    // Such a hack... since a Page.reload command does not let
    // a service worker take over we have to trick the browser into going away
    // and then coming back.
    return driver.sendCommand('Page.navigate', {url: 'about:blank'}).then(_ => {
      return driver.gotoURL(options.url, driver.WAIT_FOR_LOADED);
    });
  }

  static setupDriver(driver, gatherers, options) {
    return new Promise((resolve, reject) => {
      // Enable emulation.
      if (options.flags.emulateMobileDevice) {
        return resolve(driver.beginEmulation());
      }

      // noop if no mobile emulation
      resolve();
    }).then(_ => {
      return driver.cleanAndDisableBrowserCaches();
    }).then(_ => {
      // Force SWs to update on load.
      return driver.forceUpdateServiceWorkers();
    });
  }

  // Enable tracing and network record collection.
  static beginPassiveCollection(driver) {
    return driver.beginTrace().then(_ => {
      return driver.beginNetworkCollect();
    });
  }

  static endPassiveCollection(driver, tracingData) {
    return driver.endNetworkCollect().then(networkRecords => {
      tracingData.networkRecords = networkRecords;
    }).then(_ => {
      return driver.endTrace();
    }).then(traceContents => {
      tracingData.traceContents = traceContents;
    });
  }

  static _runPhase(gatherers, gatherFun) {
    return gatherers.reduce((chain, gatherer) => {
      return chain.then(_ => gatherFun(gatherer));
    }, Promise.resolve());
  }

  static run(gatherers, options) {
    const driver = options.driver;
    const tracingData = {};

    if (options.url === undefined || options.url === null) {
      throw new Error('You must provide a url to scheduler');
    }


    return driver.connect().then(_ => {
      return GatherScheduler.setupDriver(driver, gatherers, options);
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.setup(options));
    }).then(_ => {
      return GatherScheduler.beginPassiveCollection(driver);
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.beforePageLoad(options));
    }).then(_ => {
      return GatherScheduler.loadPage(driver, gatherers, options);
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.afterPageLoad(options));
    }).then(_ => {
      return GatherScheduler.endPassiveCollection(driver, tracingData);
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.afterTraceCollected(options, tracingData));
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.reloadSetup(options));
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.beforeReloadPageLoad(options));
    }).then(_ => {
      return GatherScheduler.reloadPage(driver, options);
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.afterReloadPageLoad(options));
    }).then(_ => {
      return driver.disconnect();
    }).then(_ => {
      return GatherScheduler._runPhase(gatherers,
          gatherer => gatherer.tearDown(options));
    }).then(_ => {
      // Collate all the gatherer results.
      return gatherers.map(g => g.artifact).concat(
          {networkRecords: tracingData.networkRecords},
          {traceContents: tracingData.traceContents});
    });
  }
}

module.exports = GatherScheduler;
