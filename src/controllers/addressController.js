const { sendError } = require('../../utils/http');
const addressService = require('../services/addressService');

async function listByUser(req, res) {
  try {
    const addresses = await addressService.listByUser(req.params.userId);
    return res.json(addresses);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function create(req, res) {
  try {
    const savedAddress = await addressService.createAddress(req.body);
    return res.status(201).json(savedAddress);
  } catch (error) {
    return sendError(res, error, 400);
  }
}

async function update(req, res) {
  try {
    const updatedAddress = await addressService.updateAddress(req.params.id, req.body);
    if (!updatedAddress) return res.status(404).json({ message: '地址不存在' });
    return res.json(updatedAddress);
  } catch (error) {
    return sendError(res, error, 400);
  }
}

async function remove(req, res) {
  try {
    const address = await addressService.deleteAddress(req.params.id);
    if (!address) return res.status(404).json({ message: '地址不存在' });
    return res.json({ message: '地址已删除' });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

module.exports = {
  listByUser,
  create,
  update,
  remove,
};
