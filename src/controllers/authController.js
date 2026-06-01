import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clearRefreshCookie, getRefreshTokenFromCookies, setRefreshCookie } from '../utils/cookies.js';
import { createRefreshToken, generateAccessToken, generateRawToken, hashToken } from '../utils/tokens.js';
import { sendVerificationEmail } from '../utils/email.js';
import { env } from '../config/env.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  isVerified: user.isVerified,
});

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existingUser = await User.findOne({ email: data.email.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const verificationToken = generateRawToken();
  const verificationTokenHash = hashToken(verificationToken);

  const user = await User.create({
    username: data.username,
    email: data.email.toLowerCase(),
    passwordHash,
    isVerified: false,
    emailVerificationTokenHash: verificationTokenHash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const verificationLink = `${env.CLIENT_URL}/verify-email/${verificationToken}`;

    let emailStatus = {
      sent: false,
      fallback: false,
    };

    try {
      emailStatus = await sendVerificationEmail({
        to: user.email,
        username: user.username,
        verificationLink,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);
    }

    return res.status(201).json({
      message: emailStatus.sent
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful. Verification link was generated. Please check backend logs if email was not sent.',
    });
  });

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification link' });
  }

  user.isVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return res.json({ message: 'Email verified successfully. You can now log in.' });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.isVerified) {
    return res.status(403).json({ message: 'Please verify your email before logging in' });
  }

  const accessToken = generateAccessToken(user._id);
  const { rawToken } = await createRefreshToken(user._id);
  setRefreshCookie(res, rawToken);

  return res.json({
    message: 'Login successful',
    accessToken,
    user: publicUser(user),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = getRefreshTokenFromCookies(req);

  if (!rawRefreshToken) {
    return res.status(401).json({ message: 'Refresh token cookie missing' });
  }

  const tokenHash = hashToken(rawRefreshToken);
  const storedToken = await RefreshToken.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate('user');

  if (!storedToken || !storedToken.user || !storedToken.user.isVerified) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  // Token rotation: revoke the old refresh token and issue a new one.
  storedToken.revokedAt = new Date();
  await storedToken.save();

  const accessToken = generateAccessToken(storedToken.user._id);
  const { rawToken } = await createRefreshToken(storedToken.user._id);
  setRefreshCookie(res, rawToken);

  return res.json({
    accessToken,
    user: publicUser(storedToken.user),
  });
});

export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = getRefreshTokenFromCookies(req);

  if (rawRefreshToken) {
    await RefreshToken.findOneAndUpdate(
      { tokenHash: hashToken(rawRefreshToken), revokedAt: null },
      { revokedAt: new Date() }
    );
  }

  clearRefreshCookie(res);
  return res.json({ message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});
