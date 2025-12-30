const Address = require('../../models/Address');

function find(query) {
  return Address.find(query);
}

function updateMany(query, update, options) {
  return Address.updateMany(query, update, options);
}

function findByIdAndUpdate(id, update, options) {
  return Address.findByIdAndUpdate(id, update, options);
}

function findByIdAndDelete(id) {
  return Address.findByIdAndDelete(id);
}

async function create(addressData) {
  const address = new Address(addressData);
  await address.save();
  return address;
}

module.exports = {
  find,
  updateMany,
  findByIdAndUpdate,
  findByIdAndDelete,
  create,
};
