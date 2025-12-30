const Logistics = require('../../models/Logistics');

function findOne(query) {
  return Logistics.findOne(query);
}

function findOneAndUpdate(query, update, options) {
  return Logistics.findOneAndUpdate(query, update, options);
}

function findOneAndDelete(query) {
  return Logistics.findOneAndDelete(query);
}

async function create(logisticsData) {
  const logistics = new Logistics(logisticsData);
  await logistics.save();
  return logistics;
}

module.exports = {
  findOne,
  findOneAndUpdate,
  findOneAndDelete,
  create,
};
