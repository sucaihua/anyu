const { fail, ERR } = require('../utils/response');

// Joi 校验：body / query / params
function validate(schema) {
  // schema: { body?, query?, params? } 每项为 Joi schema
  return (req, res, next) => {
    try {
      const sources = ['body', 'query', 'params'];
      for (const src of sources) {
        if (schema[src]) {
          const { error, value } = schema[src].validate(req[src], {
            abortEarly: true,
            stripUnknown: true,
            convert: true
          });
          if (error) {
            return fail(res, ERR.PARAMS, error.details[0].message);
          }
          req[src] = value; // 用清洗后的值
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
