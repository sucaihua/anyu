const userService = require('../services/userService');
const { success } = require('../utils/response');

async function balance(req, res, next) {
  try {
    const r = await userService.getMyBalance(req.user.id);
    return success(res, r);
  } catch (e) {
    next(e);
  }
}

async function records(req, res, next) {
  try {
    const { type = 0, page = 1, size = 20 } = req.query;
    const data = await userService.getMyRecords(req.user.id, {
      type: Number(type),
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

module.exports = { balance, records };
