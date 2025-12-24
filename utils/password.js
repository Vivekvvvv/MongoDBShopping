const bcrypt = require('bcryptjs');

// 加密强度（越大越安全但越慢）
const SALT_ROUNDS = 10;

/**
 * 密码哈希
 * @param {string} password - 原始密码
 * @returns {Promise<string>} 哈希后的密码
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * 验证密码
 * @param {string} password - 原始密码
 * @param {string} hashedPassword - 哈希后的密码
 * @returns {Promise<boolean>} 是否匹配
 */
const comparePassword = async (password, hashedPassword) => {
  // 修复登录问题：确保正确调用 bcrypt.compare 并返回结果
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

/**
 * 检查密码强度
 * @param {string} password - 密码
 * @returns {Object} 强度评估结果
 */
const checkPasswordStrength = (password) => {
  const result = {
    isStrong: false,
    score: 0,
    suggestions: []
  };

  if (password.length >= 8) {
    result.score += 1;
  } else {
    result.suggestions.push('密码长度至少8个字符');
  }

  if (/[a-z]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('包含小写字母');
  }

  if (/[A-Z]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('包含大写字母');
  }

  if (/[0-9]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('包含数字');
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('包含特殊字符');
  }

  result.isStrong = result.score >= 4;

  return result;
};

module.exports = {
  hashPassword,
  comparePassword,
  checkPasswordStrength
};
