const authService = require('../services/authService');

async function register(req, res) {
  const { name, email, password, role, merchantInfo } = req.body;

  const result = await authService.register({ name, email, password, role, merchantInfo });

  return res.status(201).json({
    message: '注册成功',
    token: result.token,
    user: result.user,
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  // 保持原日志习惯（但不要打印密码）
  console.log(`Login attempt for: ${email}`);

  const result = await authService.login({ email, password });

  return res.json({
    message: '登录成功',
    token: result.token,
    user: result.user,
  });
}

module.exports = {
  register,
  login,
};
