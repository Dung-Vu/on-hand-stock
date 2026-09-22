import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { arteService, validateReference, validateBatch, validateAmount } from '../services/arte.js';

const router = Router();

/**
 * Sanitize log strings to prevent log injection via CRLF / control characters.
 */
function sanitizeLog(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100);
}

// Dedicated rate limiter for batches lookup: 30 req / minute per IP
const batchesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Quá nhiều yêu cầu tìm kiếm lô hàng ARTE. Vui lòng thử lại sau 1 phút.',
    code: 'RATE_LIMITED',
  },
});

// Dedicated rate limiter for stock check: 20 req / minute per IP
const checkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Quá nhiều yêu cầu kiểm tra tồn kho ARTE. Vui lòng thử lại sau 1 phút.',
    code: 'RATE_LIMITED',
  },
});

/**
 * GET /api/arte/batches?reference=60741
 * Public endpoint to fetch available batches for a given reference.
 */
router.get('/batches', batchesLimiter, async (req, res) => {
  const rawReference = req.query.reference;
  const reference = validateReference(rawReference);

  if (!reference) {
    return res.status(400).json({
      success: false,
      error: 'Mã sản phẩm không hợp lệ (chỉ chấp nhận chữ cái, số, dấu chấm, gạch ngang, gạch chéo, tối đa 40 ký tự)',
      code: 'INVALID_REFERENCE',
    });
  }

  try {
    const data = await arteService.getBatches(reference);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    const status = err.status || 503;
    const code = err.code || 'UPSTREAM_ERROR';
    // Sanitized log without headers, cookies, passwords, or raw HTML
    console.error(`[ARTE /batches error] reference="${sanitizeLog(reference)}" code=${code} status=${status} message=${sanitizeLog(err.message)}`);

    return res.status(status).json({
      success: false,
      error: err.message || 'Lỗi kiểm tra danh sách lô hàng từ ARTE',
      code,
    });
  }
});

/**
 * POST /api/arte/check
 * Public endpoint to check stock availability for a reference, batch, and amount.
 */
router.post('/check', checkLimiter, async (req, res) => {
  const { reference: rawReference, batch: rawBatch, amount: rawAmount } = req.body || {};

  const reference = validateReference(rawReference);
  if (!reference) {
    return res.status(400).json({
      success: false,
      error: 'Mã sản phẩm không hợp lệ',
      code: 'INVALID_INPUT',
    });
  }

  const batch = validateBatch(rawBatch);
  if (!batch) {
    return res.status(400).json({
      success: false,
      error: 'Lô hàng không hợp lệ (chỉ chấp nhận chữ cái, số, dấu chấm, gạch ngang, gạch dưới, gạch chéo, tối đa 60 ký tự)',
      code: 'INVALID_INPUT',
    });
  }

  const amount = validateAmount(rawAmount);
  if (amount === null) {
    return res.status(400).json({
      success: false,
      error: 'Số lượng phải là số lớn hơn 0 và nhỏ hơn hoặc bằng 100,000',
      code: 'INVALID_INPUT',
    });
  }

  try {
    const data = await arteService.checkStock(reference, batch, amount);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    const status = err.status || 503;
    const code = err.code || 'UPSTREAM_ERROR';
    console.error(`[ARTE /check error] ref="${sanitizeLog(reference)}" batch="${sanitizeLog(batch)}" amount=${amount} code=${code} status=${status} message=${sanitizeLog(err.message)}`);

    return res.status(status).json({
      success: false,
      error: err.message || 'Lỗi kiểm tra tồn kho từ ARTE',
      code,
    });
  }
});

export default router;
