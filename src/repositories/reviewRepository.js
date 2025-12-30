const Review = require('../../models/Review');

function find(query) {
  return Review.find(query);
}

function findOne(query) {
  return Review.findOne(query);
}

function findById(id) {
  return Review.findById(id);
}

function countDocuments(query) {
  return Review.countDocuments(query);
}

function aggregate(pipeline) {
  return Review.aggregate(pipeline);
}

async function create(reviewData) {
  const review = new Review(reviewData);
  await review.save();
  return review;
}

module.exports = {
  find,
  findOne,
  findById,
  countDocuments,
  aggregate,
  create,
};
