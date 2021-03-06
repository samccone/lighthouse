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

const speedline = require('speedline');
const Audit = require('../audit');

const FAILURE_MESSAGE = 'Navigation and first paint timings not found.';

class SpeedIndexMetric extends Audit {
  /**
   * @override
   */
  static get category() {
    return 'Performance';
  }

  /**
   * @override
   */
  static get name() {
    return 'speed-index-metric';
  }

  /**
   * @override
   */
  static get description() {
    return 'Speed Index';
  }

  /**
   * @override
   */
  static get optimalValue() {
    return '1,000';
  }

  /**
   * Audits the page to give a score for the Speed Index.
   * @see  https://github.com/GoogleChrome/lighthouse/issues/197
   * @param {!Artifacts} artifacts The artifacts from the gather phase.
   * @return {!AuditResult} The score from the audit, ranging from 0-100.
   */
  static audit(artifacts) {
    return Promise.resolve(artifacts.traceContents).then(trace => {
      if (!trace || !Array.isArray(trace)) {
        throw new Error(FAILURE_MESSAGE);
      }
      return speedline(trace);
    }).then(results => {
      // Roughly an exponential curve.
      //   < 1000ms: penalty=0
      //   3000ms: penalty=90
      //   >= 5000ms: penalty=100
      const power = (results.speedIndex - 1000) * 0.001 * 0.5;
      const penalty = power > 0 ? Math.pow(10, power) : 0;
      let score = 100 - penalty;

      // Clamp the score to 0 <= x <= 100.
      score = Math.min(100, score);
      score = Math.max(0, score);

      return {
        score: Math.round(score),
        rawValue: Math.round(results.speedIndex)
      };
    }).catch(err => {
      // Recover from trace parsing failures.
      return {
        score: -1,
        debugString: err.message
      };
    })
    .then(result => {
      return SpeedIndexMetric.generateAuditResult({
        value: result.score,
        rawValue: result.rawValue,
        debugString: result.debugString,
        optimalValue: this.optimalValue
      });
    });
  }
}

module.exports = SpeedIndexMetric;
