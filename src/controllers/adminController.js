const { sendError } = require('../../utils/http');
const adminService = require('../services/adminService');

async function listOrders(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const result = await adminService.listOrders({ page, limit, status });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function listUsers(req, res) {
  try {
    const users = await adminService.listUsers();
    return res.json(users);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function deleteUser(req, res) {
  try {
    const user = await adminService.deleteUser(req.params.id);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    return res.json({ message: '用户已删除' });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function stats(req, res) {
  try {
    const result = await adminService.stats(req.query);
    return res.json(result);
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: '获取统计数据失败', code: 'INTERNAL_ERROR' });
  }
}

module.exports = {
  listOrders,
  listUsers,
  deleteUser,
  stats,
};
