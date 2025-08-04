// File: src/middleware/validateNetworkQuery.js
const Joi = require('joi');

const schema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(4),
  search: Joi.string().max(50).allow('', null),
  program: Joi.string().max(50).allow('', null),
  dateJoined: Joi.date().iso().allow('', null),
  skills: Joi.string().pattern(/^[a-zA-Z0-9, ]*$/).allow('', null),
});

module.exports = (req, res, next) => {
  const { error, value } = schema.validate(req.query, { stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: error.details.map(d => d.message)
    });
  }
  req.query = value;
  next();
};
