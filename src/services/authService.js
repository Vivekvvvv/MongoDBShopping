const { AppError } = require('../../middleware/errorHandler');
const { generateToken } = require('../../middleware/auth');
const { hashPassword, comparePassword, checkPasswordStrength } = require('../../utils/password');
const userRepository = require('../repositories/userRepository');

function toUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    balance: user.balance,
    merchantInfo: user.merchantInfo,
  };
}

async function register({ name, email, password, role, merchantInfo }) {
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new AppError('邮箱已被注册', 400, 'EMAIL_EXISTS');
  }

  // 保持现有行为：强度检查不强制拦截，只做长度门槛
  checkPasswordStrength(password);
  if (!password || password.length < 6) {
    throw new AppError('密码长度至少6个字符', 400, 'WEAK_PASSWORD');
  }

  const hashedPassword = await hashPassword(password);

  const userData = {
    name,
    email,
    password: hashedPassword,
    role: role || 'user',
  };

  if (role === 'merchant' && merchantInfo) {
    userData.merchantInfo = {
      shopName: merchantInfo.shopName || name,
      shopDescription: merchantInfo.shopDescription || '',
      contactPhone: merchantInfo.contactPhone || '',
      rating: 5.0,
      totalSales: 0,
    };
  }

  const user = await userRepository.create(userData);

  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  return { token, user: toUserResponse(user) };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  return { token, user: toUserResponse(user) };
}

module.exports = {
  register,
  login,
};
