const Product = require('../../models/Product');

function find(query, { populate, sort } = {}) {
  let q = Product.find(query);
  if (populate) q = q.populate(populate);
  if (sort) q = q.sort(sort);
  return q;
}

function findOne(query) {
  return Product.findOne(query);
}

function findById(id, { populate } = {}) {
  let q = Product.findById(id);
  if (populate) q = q.populate(populate);
  return q;
}

function findByIdAndDelete(id) {
  return Product.findByIdAndDelete(id);
}

function findByIdAndUpdate(id, update, options) {
  return Product.findByIdAndUpdate(id, update, options);
}

function distinct(field) {
  return Product.distinct(field);
}

function aggregate(pipeline) {
  return Product.aggregate(pipeline);
}

async function create(productData) {
  const product = new Product(productData);
  await product.save();
  return product;
}

function deleteMany(query) {
  return Product.deleteMany(query);
}

function findAll() {
  return Product.find({});
}

module.exports = {
  find,
  findOne,
  findById,
  findByIdAndDelete,
  findByIdAndUpdate,
  distinct,
  aggregate,
  create,
  deleteMany,
  findAll,
};
