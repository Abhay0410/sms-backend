// ✅ NEW VERSION: Does not touch req.query
export const getPaginationParams = (req) => {
  // Create a clean copy of values, never modify req
  const page = parseInt(req?.query?.page) || 1;
  const limit = parseInt(req?.query?.limit) || 20;
  const skip = (page - 1) * limit;

  return { 
    page: Number(page), 
    limit: Number(limit), 
    skip: Number(skip) 
  };
};

export const buildPaginatedQuery = (query, page, limit) => {
  const skip = (page - 1) * limit;
  return query.limit(limit).skip(skip);
};

export const getPaginationMeta = (page, limit, total) => {
  return {
    currentPage: parseInt(page),
    perPage: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
};
