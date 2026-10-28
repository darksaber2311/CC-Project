import { config } from '../config.js';

export const riskScoring = {
  /**
   * Calculates aggregated risk score from active rules triggered.
   * @param {Array<string>} ruleIds
   * @param {Object} context Additional context (e.g. sensitivity level)
   * @returns {{ riskScore: number, severity: string, breakdown: Array }}
   */
  calculateScore(ruleIds = [], context = {}) {
    const uniqueRules = Array.from(new Set(ruleIds));
    const breakdown = [];
    let rawScore = 0;

    for (const ruleId of uniqueRules) {
      let ruleWeight = 0;
      let reason = '';

      switch (ruleId) {
        case config.detection.failedLogins.ruleId:
          ruleWeight = config.detection.failedLogins.baseScore;
          reason = 'Multiple consecutive authentication failures';
          break;
        case config.detection.excessiveDownloads.ruleId:
          ruleWeight = config.detection.excessiveDownloads.baseScore;
          reason = 'Unusually high document download frequency';
          break;
        case config.detection.repeatedDeniedAccess.ruleId:
          ruleWeight = config.detection.repeatedDeniedAccess.baseScore;
          reason = 'Multiple unauthorized access denials';
          break;
        case config.detection.confidentialViolation.ruleId:
          ruleWeight = config.detection.confidentialViolation.baseScore;
          reason = 'Targeted access attempt against Confidential asset';
          break;
        default:
          ruleWeight = 10;
          reason = 'Unclassified anomalous event';
      }

      rawScore += ruleWeight;
      breakdown.push({ ruleId, weight: ruleWeight, reason });
    }

    // Additional sensitivity bonus if confidential asset involved
    if (context.sensitivityLevel === 'confidential' && !uniqueRules.includes(config.detection.confidentialViolation.ruleId)) {
      rawScore += 15;
      breakdown.push({
        ruleId: 'CONFIDENTIAL_TARGET_MODIFIER',
        weight: 15,
        reason: 'Asset sensitivity is classified as Confidential'
      });
    }

    const riskScore = Math.min(100, Math.max(0, rawScore));
    const severity = this.getSeverityLevel(riskScore);

    return { riskScore, severity, breakdown };
  },

  /**
   * Returns severity band ('low' | 'medium' | 'high' | 'critical')
   */
  getSeverityLevel(score) {
    if (score >= config.severityBands.critical.min) return 'critical';
    if (score >= config.severityBands.high.min) return 'high';
    if (score >= config.severityBands.medium.min) return 'medium';
    return 'low';
  }
};
