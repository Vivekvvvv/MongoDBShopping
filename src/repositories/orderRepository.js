const Order = require('../../models/Order');

function find(query) {
  return Order.find(query);
}

function countDocuments(query) {
  return Order.countDocuments(query);
}

function findById(id) {
  return Order.findById(id);
}

function findByIdAndUpdate(id, update, options) {
  return Order.findByIdAndUpdate(id, update, options);
}

function findByIdAndDelete(id) {
  return Order.findByIdAndDelete(id);
}

function aggregate(pipeline) {
  return Order.aggregate(pipeline);
}

async function create(orderData) {
  const order = new Order(orderData);
  await order.save();
  return order;
}

module.exports = {
  find,
  countDocuments,
  findById,
  findByIdAndUpdate,
  findByIdAndDelete,
  aggregate,
  create,
};
