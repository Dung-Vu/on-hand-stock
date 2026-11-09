import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { gimmerstaService } from '../services/gimmersta.js';

const router = Router();
const limiter = rateLimit({
  windowMs: 60000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    error: 'Quá nhiều yêu cầu tra cứu. Vui lòng thử lại sau.',
  },
});

router.get('/stock', limiter, async (req, res) => {
  try {
    const data = await gimmerstaService.lookup(req.query.product);
    res.json({ success: true, data });
  } catch (err) {
    const code = err.code || 'UPSTREAM_ERROR';
    const status = err.status || 503;
    // Never log credentials, cookies, upstream HTML, or user-supplied URLs.
    console.error(`[Gimmersta stock] code=${code} status=${status}`);
    res.status(status).json({ success: false, code, error: 'Không thể tra cứu Gimmersta' });
  }
});

export default router;
