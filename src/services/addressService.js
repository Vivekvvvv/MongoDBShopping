const addressRepository = require('../repositories/addressRepository');

async function listByUser(userId) {
  const addresses = await addressRepository
    .find({ userId })
    .sort({ isDefault: -1, createdAt: -1 });
  return addresses;
}

async function createAddress(body) {
  const { userId, isDefault } = body;

  if (isDefault) {
    await addressRepository.updateMany({ userId, isDefault: true }, { isDefault: false });
  }

  return addressRepository.create(body);
}

async function updateAddress(addressId, body) {
  const { isDefault, userId } = body;

  if (isDefault) {
    await addressRepository.updateMany({ userId, isDefault: true }, { isDefault: false });
  }

  const updatedAddress = await addressRepository.findByIdAndUpdate(addressId, body, {
    new: true,
    runValidators: true,
  });

  return updatedAddress;
}

async function deleteAddress(addressId) {
  return addressRepository.findByIdAndDelete(addressId);
}

module.exports = {
  listByUser,
  createAddress,
  updateAddress,
  deleteAddress,
};
