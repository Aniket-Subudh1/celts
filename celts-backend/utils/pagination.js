/**
 *
 * 
 * @param {object} req - Express request
 * @param {mongoose.Model} Model - Mongoose model
 * @param {object} options
 */
async function paginate(req, Model, options = {}) {
  const {
    filter = {},
    searchFields = [],
    populate = [],
    select = null,
    sort = { createdAt: -1 },
    map = null,
    maxLimit = 150,
    defaultLimit = 100
  } = options;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(
    maxLimit,
    parseInt(req.query.limit) || defaultLimit
  );

  const skip = (page - 1) * limit;

  let queryFilter = { ...filter };

  // 🔍 Search support
  if (req.query.search && searchFields.length) {
    const regex = new RegExp(req.query.search, "i");
    queryFilter.$or = searchFields.map((field) => ({
      [field]: regex
    }));
  }

  let query = Model.find(queryFilter);

  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (populate.length) {
    populate.forEach((p) => (query = query.populate(p)));
  }

  const [items, total] = await Promise.all([
    query.skip(skip).limit(limit).lean(),
    Model.countDocuments(queryFilter)
  ]);

  const data = map ? items.map(map) : items;

  return {
    data,
    page,
    limit,
    total,
    hasNext: skip + data.length < total
  };
}

module.exports = { paginate };
