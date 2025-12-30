const User = require('../../models/User');

function find(query, { select, sort } = {}) {
  let q = User.find(query);
  if (select) q = q.select(select);
  if (sort) q = q.sort(sort);
  return q;
}

function countDocuments(query) {
  return User.countDocuments(query);
}

function findByEmail(email) {
  return User.findOne({ email });
}

async function create(userData) {
  const user = new User(userData);
  await user.save();
  return user;
}

function findById(id, { populate } = {}) {
  let q = User.findById(id);
  if (populate) q = q.populate(populate);
  return q;
}

function findOne(query) {
  return User.findOne(query);
}

function findOneAndUpdate(filter, update, options) {
  return User.findOneAndUpdate(filter, update, options);
}

function findOneAndDelete(filter) {
  return User.findOneAndDelete(filter);
}

function findByIdAndUpdate(id, update, options) {
  return User.findByIdAndUpdate(id, update, options);
}

function findByIdAndDelete(id) {
  return User.findByIdAndDelete(id);
}

module.exports = {
  find,
  countDocuments,
  findByEmail,
  findById,
  findOne,
  findOneAndUpdate,
  findOneAndDelete,
  findByIdAndUpdate,
  findByIdAndDelete,
  create,
};
