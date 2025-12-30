const { sendError } = require('../../utils/http');
const analyticsService = require('../services/analyticsService');

async function products(req, res) {
  try {
    const result = await analyticsService.productsAnalytics();
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function orders(req, res) {
  try {
    const result = await analyticsService.ordersAnalytics(req.query);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

module.exports = {
  products,
  orders,
};
