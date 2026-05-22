const router = require('express').Router();

router.post('/score', (req, res) => {
  const { consentSigned = false, usageChannels = [], expiresInDays = 90, minorFeatured = false, musicLicensed = true } = req.body || {};
  const channelRisk = Math.max(0, (Array.isArray(usageChannels) ? usageChannels.length : 0) - 2) * 12;
  const score = Math.min(100, Math.round(
    (consentSigned ? 0 : 35) +
    channelRisk +
    (Number(expiresInDays) < 30 ? 20 : 0) +
    (minorFeatured ? 25 : 0) +
    (musicLicensed ? 0 : 20)
  ));
  res.json({
    feature: 'consent_rights_check',
    score,
    level: score >= 70 ? 'block-publish' : score >= 35 ? 'legal-review' : 'clear',
    actions: [
      !consentSigned && 'Collect signed testimonial release before publishing.',
      minorFeatured && 'Require guardian approval for any minor appearing in footage.',
      !musicLicensed && 'Replace or license music before export.',
      Number(expiresInDays) < 30 && 'Renew usage window before campaign launch.',
    ].filter(Boolean),
  });
});

module.exports = router;
