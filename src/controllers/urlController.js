import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { Url } from '../models/Url.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createUrlSchema, updateUrlSchema } from '../validators/urlValidators.js';
import { env } from '../config/env.js';

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeUrl = (value) => {
  const parsed = new URL(value);
  return parsed.toString();
};

const hashIp = (ip) => {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
};

const buildShortUrl = (shortCode) => `${env.SERVER_URL}/${shortCode}`;

const generateUniqueCode = async () => {
  for (let i = 0; i < 5; i += 1) {
    const code = nanoid(8);
    const exists = await Url.exists({ shortCode: code });
    if (!exists) return code;
  }
  throw createError(500, 'Could not generate a unique short code. Try again.');
};

const summarizeVisitsByDate = (visits) => {
  const map = new Map();

  for (const visit of visits) {
    const key = new Date(visit.visitedAt).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
};

export const redirectUrl = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const urlDoc = await Url.findOne({ shortCode: code });
  if (!urlDoc) {
    return res.status(404).send('Short URL not found');
  }

  if (urlDoc.expiresAt && urlDoc.expiresAt < new Date()) {
    return res.status(410).send('This short URL has expired');
  }

  await Url.updateOne(
    { _id: urlDoc._id },
    {
      $inc: { visitCount: 1 },
      $push: {
        visits: {
          visitedAt: new Date(),
          userAgent: req.get('user-agent') || 'unknown',
          referrer: req.get('referer') || 'direct',
          ipHash: hashIp(req.ip),
        },
      },
    }
  );

  return res.redirect(urlDoc.originalUrl);
});

export const createUrl = asyncHandler(async (req, res) => {
  const data = createUrlSchema.parse(req.body);

  let shortCode = data.customCode || null;

  if (shortCode) {
    const exists = await Url.exists({ shortCode });
    if (exists) throw createError(409, 'This short code is already taken');
  } else {
    shortCode = await generateUniqueCode();
  }

  const urlDoc = await Url.create({
    owner: req.user._id,
    originalUrl: normalizeUrl(data.originalUrl),
    shortCode,
    expiresAt: data.expiresAt || null,
  });

  return res.status(201).json({
    message: 'Short URL created',
    url: {
      id: urlDoc._id,
      originalUrl: urlDoc.originalUrl,
      shortCode: urlDoc.shortCode,
      shortUrl: buildShortUrl(urlDoc.shortCode),
      expiresAt: urlDoc.expiresAt,
      visitCount: urlDoc.visitCount,
      createdAt: urlDoc.createdAt,
    },
  });
});

export const getUrls = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Url.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-visits'),
    Url.countDocuments({ owner: req.user._id }),
  ]);

  return res.json({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    urls: items.map((item) => ({
      id: item._id,
      originalUrl: item.originalUrl,
      shortCode: item.shortCode,
      shortUrl: buildShortUrl(item.shortCode),
      expiresAt: item.expiresAt,
      visitCount: item.visitCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
});

export const getUrlDetails = asyncHandler(async (req, res) => {
  const urlDoc = await Url.findOne({ _id: req.params.id, owner: req.user._id });

  if (!urlDoc) {
    throw createError(404, 'URL not found');
  }

  return res.json({
    url: {
      id: urlDoc._id,
      originalUrl: urlDoc.originalUrl,
      shortCode: urlDoc.shortCode,
      shortUrl: buildShortUrl(urlDoc.shortCode),
      expiresAt: urlDoc.expiresAt,
      visitCount: urlDoc.visitCount,
      createdAt: urlDoc.createdAt,
      updatedAt: urlDoc.updatedAt,
      visitsByDate: summarizeVisitsByDate(urlDoc.visits),
      recentVisits: urlDoc.visits
        .slice(-10)
        .reverse()
        .map((visit) => ({
          visitedAt: visit.visitedAt,
          userAgent: visit.userAgent,
          referrer: visit.referrer,
        })),
    },
  });
});

export const updateUrl = asyncHandler(async (req, res) => {
  const data = updateUrlSchema.parse(req.body);

  const urlDoc = await Url.findOne({ _id: req.params.id, owner: req.user._id });
  if (!urlDoc) {
    throw createError(404, 'URL not found');
  }

  if (data.originalUrl) {
    urlDoc.originalUrl = normalizeUrl(data.originalUrl);
  }

  if (data.customCode) {
    const exists = await Url.exists({ shortCode: data.customCode, _id: { $ne: urlDoc._id } });
    if (exists) throw createError(409, 'This short code is already taken');
    urlDoc.shortCode = data.customCode;
  }

  if ('expiresAt' in data) {
    urlDoc.expiresAt = data.expiresAt || null;
  }

  await urlDoc.save();

  return res.json({
    message: 'URL updated',
    url: {
      id: urlDoc._id,
      originalUrl: urlDoc.originalUrl,
      shortCode: urlDoc.shortCode,
      shortUrl: buildShortUrl(urlDoc.shortCode),
      expiresAt: urlDoc.expiresAt,
      visitCount: urlDoc.visitCount,
      createdAt: urlDoc.createdAt,
      updatedAt: urlDoc.updatedAt,
    },
  });
});

export const deleteUrl = asyncHandler(async (req, res) => {
  const deleted = await Url.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

  if (!deleted) {
    throw createError(404, 'URL not found');
  }

  return res.json({ message: 'URL deleted' });
});
