const { sendError } = require('../../utils/http');
const behaviorService = require('../services/behaviorService');

async function recordProductView(req, res) {
  try {
    const { userId } = req.body;
    const productId = req.params.id;

    const result = await behaviorService.recordProductView({ userId, productId });

    if (result.guest) {
      return res.json({ message: result.message });
    }

    if (result.notFound) {
      return res.status(404).json({ message: result.message });
    }

    return res.json({ message: result.message });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

module.exports = {
  recordProductView,
};
