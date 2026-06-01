import { ZodError } from 'zod';

export const errorHandler = (error, req, res, next) => {
  console.error(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.errors.map((item) => item.message),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value already exists' });
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    message: error.message || 'Internal server error',
  });
};
