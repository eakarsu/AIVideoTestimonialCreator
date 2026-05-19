require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const crypto = require('crypto');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || `http://localhost:${process.env.FRONTEND_PORT || 3000}`,
  credentials: true
}));
app.use(express.json());

// ─── Rate Limiters ───────────────────────────────────────────────
let ipKeyGenerator;
try { ipKeyGenerator = require('express-rate-limit').ipKeyGenerator; } catch (e) { ipKeyGenerator = (req) => req.ip; }
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req.user && req.user.id) ? String(req.user.id) : (typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req) : req.ip),
  message: { error: 'AI rate limit exceeded. Max 20 requests per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── parseAIJson ─────────────────────────────────────────────────
function parseAIJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) { try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {} }
  return null;
}

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// RBAC Middleware
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) return res.status(403).json({ error: 'Access denied' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
};

// Search/Filter/Sort/Pagination helper
function buildListQuery(baseTable, req, textColumns = [], defaultSort = 'created_at') {
  const { search, sort_by, sort_order, page, limit: limitParam, ...filters } = req.query;
  let query = `SELECT * FROM ${baseTable}`;
  let countQuery = `SELECT COUNT(*) as total FROM ${baseTable}`;
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  // Search across text columns
  if (search && textColumns.length > 0) {
    const searchConditions = textColumns.map(col => {
      params.push(`%${search}%`);
      return `${col}::text ILIKE $${paramIndex++}`;
    });
    conditions.push(`(${searchConditions.join(' OR ')})`);
  }

  // Filters
  const filterPrefix = 'filter_';
  for (const [key, value] of Object.entries(filters)) {
    if (key.startsWith(filterPrefix) && value) {
      const column = key.slice(filterPrefix.length);
      params.push(value);
      conditions.push(`${column} = $${paramIndex++}`);
    }
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  query += whereClause;
  countQuery += whereClause;

  // Sort
  const allowedSortOrders = ['asc', 'desc'];
  const sortCol = sort_by || defaultSort;
  const sortOrd = allowedSortOrders.includes(sort_order?.toLowerCase()) ? sort_order.toLowerCase() : 'DESC';
  query += ` ORDER BY ${sortCol} ${sortOrd}`;

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limitParam) || 25;
  const offset = (pageNum - 1) * limitNum;
  params.push(limitNum);
  query += ` LIMIT $${paramIndex++}`;
  params.push(offset);
  query += ` OFFSET $${paramIndex++}`;

  return { query, countQuery, params, countParams: params.slice(0, paramIndex - 3), pageNum, limitNum };
}

async function executeListQuery(baseTable, req, res, textColumns = [], defaultSort = 'created_at') {
  const { query, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(baseTable, req, textColumns, defaultSort);
  const result = await pool.query(query, params);
  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].total);
  res.json({ data: result.rows, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
}

// OpenRouter AI Helper
async function callOpenRouter(prompt, systemPrompt = '') {
  try {
    const response = await axios.post(
      `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful AI assistant for creating video testimonials.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Video Testimonial Creator'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('OpenRouter Error:', error.response?.data || error.message);
    throw error;
  }
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'editor' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role || 'editor' } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, 'editor']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.rows[0].id, token, expiresAt]
    );
    console.log(`[Password Reset] Token for ${email}: ${token}`);
    res.json({ message: 'If that email exists, a reset link has been sent.', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const result = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, result.rows[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [result.rows[0].id]);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REVIEWS ROUTES ====================
app.get('/api/reviews', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('reviews', req, res, ['customer_name', 'customer_email', 'company', 'review_text', 'source']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { customer_name, customer_email, company, rating, review_text, source } = req.body;
    const result = await pool.query(
      'INSERT INTO reviews (customer_name, customer_email, company, rating, review_text, source) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [customer_name, customer_email, company, rating, review_text, source]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const { customer_name, customer_email, company, rating, review_text, source } = req.body;
    const result = await pool.query(
      'UPDATE reviews SET customer_name=$1, customer_email=$2, company=$3, rating=$4, review_text=$5, source=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [customer_name, customer_email, company, rating, review_text, source, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/reviews/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AVATARS ROUTES ====================
app.get('/api/avatars', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('avatars', req, res, ['name', 'provider', 'gender', 'style']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/avatars/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM avatars WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/avatars', authenticateToken, async (req, res) => {
  try {
    const { name, provider, avatar_id, gender, style, thumbnail_url } = req.body;
    const result = await pool.query(
      'INSERT INTO avatars (name, provider, avatar_id, gender, style, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, provider, avatar_id, gender, style, thumbnail_url]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/avatars/:id', authenticateToken, async (req, res) => {
  try {
    const { name, provider, avatar_id, gender, style, thumbnail_url } = req.body;
    const result = await pool.query(
      'UPDATE avatars SET name=$1, provider=$2, avatar_id=$3, gender=$4, style=$5, thumbnail_url=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [name, provider, avatar_id, gender, style, thumbnail_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/avatars/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM avatars WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TEMPLATES ROUTES ====================
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('templates', req, res, ['name', 'description', 'category', 'font_style', 'animation_type']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const { name, description, duration, background_color, font_style, animation_type, category } = req.body;
    const result = await pool.query(
      'INSERT INTO templates (name, description, duration, background_color, font_style, animation_type, category) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, description, duration, background_color, font_style, animation_type, category]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, duration, background_color, font_style, animation_type, category } = req.body;
    const result = await pool.query(
      'UPDATE templates SET name=$1, description=$2, duration=$3, background_color=$4, font_style=$5, animation_type=$6, category=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [name, description, duration, background_color, font_style, animation_type, category, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VIDEOS ROUTES ====================
app.get('/api/videos', authenticateToken, async (req, res) => {
  try {
    const { search, sort_by, sort_order, page, limit: limitParam, ...rest } = req.query;
    let baseQuery = `SELECT v.*, r.customer_name, r.review_text, a.name as avatar_name, t.name as template_name FROM videos v LEFT JOIN reviews r ON v.review_id = r.id LEFT JOIN avatars a ON v.avatar_id = a.id LEFT JOIN templates t ON v.template_id = t.id`;
    let countQuery = `SELECT COUNT(*) as total FROM videos v LEFT JOIN reviews r ON v.review_id = r.id LEFT JOIN avatars a ON v.avatar_id = a.id LEFT JOIN templates t ON v.template_id = t.id`;
    const params = [];
    const conditions = [];
    let paramIndex = 1;
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(v.title ILIKE $${paramIndex} OR r.customer_name ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex} OR t.name ILIKE $${paramIndex})`);
      paramIndex++;
    }
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith('filter_') && value) {
        const col = key.slice(7);
        params.push(value);
        conditions.push(`v.${col} = $${paramIndex++}`);
      }
    }
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    baseQuery += where;
    countQuery += where;
    const sortCol = sort_by ? `v.${sort_by}` : 'v.created_at';
    const sortOrd = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    baseQuery += ` ORDER BY ${sortCol} ${sortOrd}`;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limitParam) || 25;
    params.push(limitNum);
    baseQuery += ` LIMIT $${paramIndex++}`;
    params.push((pageNum - 1) * limitNum);
    baseQuery += ` OFFSET $${paramIndex++}`;
    const result = await pool.query(baseQuery, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 3));
    const total = parseInt(countResult.rows[0].total);
    res.json({ data: result.rows, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, r.customer_name, r.review_text, r.company, r.rating,
             a.name as avatar_name, a.thumbnail_url as avatar_thumbnail,
             t.name as template_name
      FROM videos v
      LEFT JOIN reviews r ON v.review_id = r.id
      LEFT JOIN avatars a ON v.avatar_id = a.id
      LEFT JOIN templates t ON v.template_id = t.id
      WHERE v.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/videos', authenticateToken, async (req, res) => {
  try {
    const { title, review_id, avatar_id, template_id, status, video_url, duration } = req.body;
    const result = await pool.query(
      'INSERT INTO videos (title, review_id, avatar_id, template_id, status, video_url, duration) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        title,
        review_id ? parseInt(review_id) : null,
        avatar_id ? parseInt(avatar_id) : null,
        template_id ? parseInt(template_id) : null,
        status || 'pending',
        video_url || null,
        duration ? parseInt(duration) : null
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Video create error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    const { title, review_id, avatar_id, template_id, status, video_url, duration } = req.body;
    const result = await pool.query(
      'UPDATE videos SET title=$1, review_id=$2, avatar_id=$3, template_id=$4, status=$5, video_url=$6, duration=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [
        title,
        review_id ? parseInt(review_id) : null,
        avatar_id ? parseInt(avatar_id) : null,
        template_id ? parseInt(template_id) : null,
        status || 'pending',
        video_url || null,
        duration ? parseInt(duration) : null,
        req.params.id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Video update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SCRIPTS ROUTES ====================
app.get('/api/scripts', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('scripts', req, res, ['title', 'content', 'tone']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/scripts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scripts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/scripts', authenticateToken, async (req, res) => {
  try {
    const { title, content, tone, word_count, review_id } = req.body;
    const result = await pool.query(
      'INSERT INTO scripts (title, content, tone, word_count, review_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, tone || null, word_count ? parseInt(word_count) : null, review_id ? parseInt(review_id) : null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Script create error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/scripts/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content, tone, word_count, review_id } = req.body;
    const result = await pool.query(
      'UPDATE scripts SET title=$1, content=$2, tone=$3, word_count=$4, review_id=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [title, content, tone, word_count, review_id, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/scripts/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM scripts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VOICEOVERS ROUTES ====================
app.get('/api/voiceovers', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('voiceovers', req, res, ['name', 'provider', 'language', 'gender', 'accent']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/voiceovers/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM voiceovers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/voiceovers', authenticateToken, async (req, res) => {
  try {
    const { name, voice_id, provider, language, gender, accent, sample_url } = req.body;
    const result = await pool.query(
      'INSERT INTO voiceovers (name, voice_id, provider, language, gender, accent, sample_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, voice_id, provider, language, gender, accent, sample_url]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/voiceovers/:id', authenticateToken, async (req, res) => {
  try {
    const { name, voice_id, provider, language, gender, accent, sample_url } = req.body;
    const result = await pool.query(
      'UPDATE voiceovers SET name=$1, voice_id=$2, provider=$3, language=$4, gender=$5, accent=$6, sample_url=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [name, voice_id, provider, language, gender, accent, sample_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/voiceovers/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM voiceovers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== INTERVIEW QUESTIONS ROUTES ====================
app.get('/api/interview-questions', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('interview_questions', req, res, ['title', 'topic', 'difficulty', 'question_type', 'context', 'industry']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/interview-questions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM interview_questions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/interview-questions', authenticateToken, async (req, res) => {
  try {
    const { title, topic, difficulty, question_type, questions, context, industry } = req.body;
    const result = await pool.query(
      'INSERT INTO interview_questions (title, topic, difficulty, question_type, questions, context, industry) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, topic, difficulty, question_type, JSON.stringify(questions), context, industry]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/interview-questions/:id', authenticateToken, async (req, res) => {
  try {
    const { title, topic, difficulty, question_type, questions, context, industry } = req.body;
    const result = await pool.query(
      'UPDATE interview_questions SET title=$1, topic=$2, difficulty=$3, question_type=$4, questions=$5, context=$6, industry=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [title, topic, difficulty, question_type, JSON.stringify(questions), context, industry, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/interview-questions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM interview_questions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SPORTS HIGHLIGHTS ROUTES ====================
app.get('/api/sports-highlights', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('sports_highlights', req, res, ['title', 'sport_type', 'event_name', 'team_name', 'player_name', 'highlight_type', 'description']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/sports-highlights/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sports_highlights WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sports-highlights', authenticateToken, async (req, res) => {
  try {
    const { title, sport_type, event_name, team_name, player_name, highlight_type, start_time, end_time, duration, description, tags, video_url, thumbnail_url, ai_analysis } = req.body;
    const result = await pool.query(
      'INSERT INTO sports_highlights (title, sport_type, event_name, team_name, player_name, highlight_type, start_time, end_time, duration, description, tags, video_url, thumbnail_url, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
      [title, sport_type, event_name, team_name, player_name, highlight_type, start_time, end_time, duration, description, JSON.stringify(tags), video_url, thumbnail_url, JSON.stringify(ai_analysis)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sports-highlights/:id', authenticateToken, async (req, res) => {
  try {
    const { title, sport_type, event_name, team_name, player_name, highlight_type, start_time, end_time, duration, description, tags, video_url, thumbnail_url, ai_analysis } = req.body;
    const result = await pool.query(
      'UPDATE sports_highlights SET title=$1, sport_type=$2, event_name=$3, team_name=$4, player_name=$5, highlight_type=$6, start_time=$7, end_time=$8, duration=$9, description=$10, tags=$11, video_url=$12, thumbnail_url=$13, ai_analysis=$14, updated_at=NOW() WHERE id=$15 RETURNING *',
      [title, sport_type, event_name, team_name, player_name, highlight_type, start_time, end_time, duration, description, JSON.stringify(tags), video_url, thumbnail_url, JSON.stringify(ai_analysis), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sports-highlights/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM sports_highlights WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== HIGHLIGHTS ROUTES ====================
app.get('/api/highlights', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('highlights', req, res, ['title', 'source_type', 'content_type', 'description', 'transcript_snippet']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/highlights/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM highlights WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/highlights', authenticateToken, async (req, res) => {
  try {
    const { title, source_type, content_type, start_time, end_time, duration, description, importance_score, keywords, transcript_snippet, video_url, thumbnail_url, ai_analysis } = req.body;
    const result = await pool.query(
      'INSERT INTO highlights (title, source_type, content_type, start_time, end_time, duration, description, importance_score, keywords, transcript_snippet, video_url, thumbnail_url, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
      [title, source_type, content_type, start_time, end_time, duration, description, importance_score, JSON.stringify(keywords), transcript_snippet, video_url, thumbnail_url, JSON.stringify(ai_analysis)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/highlights/:id', authenticateToken, async (req, res) => {
  try {
    const { title, source_type, content_type, start_time, end_time, duration, description, importance_score, keywords, transcript_snippet, video_url, thumbnail_url, ai_analysis } = req.body;
    const result = await pool.query(
      'UPDATE highlights SET title=$1, source_type=$2, content_type=$3, start_time=$4, end_time=$5, duration=$6, description=$7, importance_score=$8, keywords=$9, transcript_snippet=$10, video_url=$11, thumbnail_url=$12, ai_analysis=$13, updated_at=NOW() WHERE id=$14 RETURNING *',
      [title, source_type, content_type, start_time, end_time, duration, description, importance_score, JSON.stringify(keywords), transcript_snippet, video_url, thumbnail_url, JSON.stringify(ai_analysis), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/highlights/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM highlights WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== B-ROLL SUGGESTIONS ROUTES ====================
app.get('/api/broll-suggestions', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('broll_suggestions', req, res, ['title', 'context', 'industry', 'mood', 'style_notes']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/broll-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM broll_suggestions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/broll-suggestions', authenticateToken, async (req, res) => {
  try {
    const { title, context, industry, mood, keywords, suggestions, stock_sources, style_notes, color_palette } = req.body;
    const result = await pool.query(
      'INSERT INTO broll_suggestions (title, context, industry, mood, keywords, suggestions, stock_sources, style_notes, color_palette) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [title, context, industry, mood, JSON.stringify(keywords), JSON.stringify(suggestions), JSON.stringify(stock_sources), style_notes, JSON.stringify(color_palette)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/broll-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const { title, context, industry, mood, keywords, suggestions, stock_sources, style_notes, color_palette } = req.body;
    const result = await pool.query(
      'UPDATE broll_suggestions SET title=$1, context=$2, industry=$3, mood=$4, keywords=$5, suggestions=$6, stock_sources=$7, style_notes=$8, color_palette=$9, updated_at=NOW() WHERE id=$10 RETURNING *',
      [title, context, industry, mood, JSON.stringify(keywords), JSON.stringify(suggestions), JSON.stringify(stock_sources), style_notes, JSON.stringify(color_palette), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/broll-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM broll_suggestions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== MUSIC MATCHES ROUTES ====================
app.get('/api/music-matches', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('music_matches', req, res, ['title', 'content_type', 'mood', 'genre', 'tempo', 'energy_level']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/music-matches/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM music_matches WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/music-matches', authenticateToken, async (req, res) => {
  try {
    const { title, content_type, mood, genre, tempo, energy_level, duration, suggestions, licensing_info, style_notes } = req.body;
    const result = await pool.query(
      'INSERT INTO music_matches (title, content_type, mood, genre, tempo, energy_level, duration, suggestions, licensing_info, style_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [title, content_type, mood, genre, tempo, energy_level, duration, JSON.stringify(suggestions), licensing_info, style_notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/music-matches/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content_type, mood, genre, tempo, energy_level, duration, suggestions, licensing_info, style_notes } = req.body;
    const result = await pool.query(
      'UPDATE music_matches SET title=$1, content_type=$2, mood=$3, genre=$4, tempo=$5, energy_level=$6, duration=$7, suggestions=$8, licensing_info=$9, style_notes=$10, updated_at=NOW() WHERE id=$11 RETURNING *',
      [title, content_type, mood, genre, tempo, energy_level, duration, JSON.stringify(suggestions), licensing_info, style_notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/music-matches/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM music_matches WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TRANSCRIPTS ROUTES ====================
app.get('/api/transcripts', authenticateToken, async (req, res) => {
  try {
    await executeListQuery('transcripts', req, res, ['title', 'source_type', 'language', 'content', 'summary']);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/transcripts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transcripts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/transcripts', authenticateToken, async (req, res) => {
  try {
    const { title, source_type, language, duration, content, timestamps, speakers, keywords, summary, confidence_score, video_url } = req.body;
    const result = await pool.query(
      'INSERT INTO transcripts (title, source_type, language, duration, content, timestamps, speakers, keywords, summary, confidence_score, video_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [title, source_type, language, duration, content, JSON.stringify(timestamps), JSON.stringify(speakers), JSON.stringify(keywords), summary, confidence_score, video_url]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/transcripts/:id', authenticateToken, async (req, res) => {
  try {
    const { title, source_type, language, duration, content, timestamps, speakers, keywords, summary, confidence_score, video_url } = req.body;
    const result = await pool.query(
      'UPDATE transcripts SET title=$1, source_type=$2, language=$3, duration=$4, content=$5, timestamps=$6, speakers=$7, keywords=$8, summary=$9, confidence_score=$10, video_url=$11, updated_at=NOW() WHERE id=$12 RETURNING *',
      [title, source_type, language, duration, content, JSON.stringify(timestamps), JSON.stringify(speakers), JSON.stringify(keywords), summary, confidence_score, video_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/transcripts/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM transcripts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AI GENERATION SAVE HELPER ====================

const TOOL_NAMES = {
  'generate-script': 'Generate Script',
  'enhance-review': 'Enhance Review',
  'suggest-avatar': 'Suggest Avatar',
  'analyze-sentiment': 'Analyze Sentiment',
  'generate-metadata': 'Generate Metadata',
  'generate-cta': 'Generate CTA',
  'translate': 'Translate',
  'suggest-template': 'Suggest Template',
  'generate-package': 'Complete Package',
  'generate-variations': 'A/B Variations',
  'generate-interview-questions': 'Interview Questions',
  'analyze-sports-highlights': 'Sports Highlights',
  'analyze-highlights': 'Video Highlights',
  'suggest-broll': 'B-Roll Suggester',
  'suggest-music': 'Music Matcher',
  'generate-transcript': 'Transcript Generator',
};

async function saveAIGeneration(userId, toolId, inputData, result, aiResponse) {
  try {
    const toolName = TOOL_NAMES[toolId] || toolId;

    // Generate input summary from first meaningful text field
    const inputValues = Object.values(inputData || {});
    const firstText = inputValues.find(v => typeof v === 'string' && v.length > 5) || '';
    const inputSummary = firstText.substring(0, 100) + (firstText.length > 100 ? '...' : '');

    // Generate output summary from first content field
    const outputContent = Object.values(result || {}).find(v => typeof v === 'string' && v.length > 10) || '';
    const outputSummary = outputContent.substring(0, 150) + (outputContent.length > 150 ? '...' : '');

    const model = result.model || aiResponse?.model || null;
    const totalTokens = result.usage?.total_tokens || aiResponse?.usage?.total_tokens || null;
    const generatedAt = result.generatedAt || new Date().toISOString();

    await pool.query(
      `INSERT INTO ai_generations (user_id, tool_id, tool_name, input_data, input_summary, output_data, output_summary, model, total_tokens, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, toolId, toolName, JSON.stringify(inputData), inputSummary, JSON.stringify(result), outputSummary, model, totalTokens, generatedAt]
    );
  } catch (err) {
    console.error('Failed to save AI generation:', err.message);
  }
}

// ==================== AI HISTORY ROUTES ====================

// List AI generations
app.get('/api/ai-history', authenticateToken, async (req, res) => {
  try {
    const { tool_id } = req.query;
    let query = 'SELECT id, tool_id, tool_name, input_summary, output_summary, model, total_tokens, generated_at, created_at FROM ai_generations WHERE user_id = $1';
    const params = [req.user.id];

    if (tool_id) {
      query += ' AND tool_id = $2';
      params.push(tool_id);
    }

    query += ' ORDER BY generated_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single AI generation detail
app.get('/api/ai-history/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_generations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete single AI generation
app.delete('/api/ai-history/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM ai_generations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AI FEATURES ROUTES ====================

// Generate Script from Review
app.post('/api/ai/generate-script', authenticateToken, async (req, res) => {
  try {
    const { review_text, customer_name, company, tone = 'professional' } = req.body;

    const prompt = `Create a compelling video testimonial script based on this customer review.

Customer: ${customer_name}
Company: ${company}
Original Review: "${review_text}"
Desired Tone: ${tone}

Generate a natural-sounding script that:
1. Sounds conversational, as if the customer is speaking directly to camera
2. Highlights the key benefits and positive experiences
3. Includes a brief introduction and conclusion
4. Is between 100-150 words for optimal video length
5. Feels authentic and genuine

Return the script in a structured format with:
- Opening hook
- Main testimonial content
- Closing statement with recommendation`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert scriptwriter specializing in authentic video testimonials. Create engaging, natural scripts that feel genuine.');

    const result = {
      script: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-script', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enhance Review Text
app.post('/api/ai/enhance-review', authenticateToken, async (req, res) => {
  try {
    const { review_text, enhancement_type = 'polish' } = req.body;

    const prompt = `Enhance this customer review while maintaining its authenticity.

Original Review: "${review_text}"
Enhancement Type: ${enhancement_type}

Tasks based on enhancement type:
- If "polish": Fix grammar, improve clarity, maintain original sentiment
- If "expand": Add more detail and emotion while staying true to the core message
- If "condense": Make it more concise while keeping key points
- If "professional": Make it sound more business-appropriate

Provide the enhanced version and explain what changes were made.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert editor who enhances customer testimonials while preserving authenticity.');

    const result = {
      enhanced_review: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      enhancement_type,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'enhance-review', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suggest Avatar for Review
app.post('/api/ai/suggest-avatar', authenticateToken, async (req, res) => {
  try {
    const { review_text, customer_name, company, industry } = req.body;

    const prompt = `Based on this testimonial, suggest the ideal AI avatar characteristics.

Customer: ${customer_name}
Company: ${company}
Industry: ${industry || 'General'}
Review: "${review_text}"

Analyze the review and suggest:
1. Avatar demographic (age range, gender, professional appearance)
2. Speaking style (pace, energy level, formality)
3. Background setting recommendation
4. Attire suggestions
5. Emotional tone for delivery

Provide specific recommendations that would make the video feel authentic and relatable to the target audience.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert in video production and audience engagement. Suggest avatar characteristics that maximize testimonial effectiveness.');

    const result = {
      suggestions: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'suggest-avatar', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze Review Sentiment
app.post('/api/ai/analyze-sentiment', authenticateToken, async (req, res) => {
  try {
    const { review_text } = req.body;

    const prompt = `Perform a comprehensive sentiment analysis on this customer review.

Review: "${review_text}"

Provide:
1. Overall Sentiment Score (1-10 scale, where 10 is most positive)
2. Emotional Breakdown (percentages for: Joy, Trust, Satisfaction, Enthusiasm, Gratitude)
3. Key Positive Phrases (list the most impactful positive statements)
4. Suggested Video Tone (based on sentiment)
5. Target Audience Fit (who would resonate most with this testimonial)
6. Virality Potential (likelihood this would be shared, and why)

Format as a structured analysis.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a sentiment analysis expert specializing in customer testimonials and marketing effectiveness.');

    const result = {
      analysis: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'analyze-sentiment', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Video Title and Description
app.post('/api/ai/generate-metadata', authenticateToken, async (req, res) => {
  try {
    const { review_text, customer_name, company, platform = 'general' } = req.body;

    const prompt = `Create optimized video metadata for this testimonial.

Customer: ${customer_name}
Company: ${company}
Platform: ${platform}
Review: "${review_text}"

Generate:
1. Video Title Options (3 compelling titles, under 60 characters each)
2. Short Description (for YouTube/social media, 150 characters)
3. Long Description (for video page, 300-500 characters)
4. Hashtags (10 relevant hashtags)
5. Keywords (SEO-optimized keywords)
6. Thumbnail Text Suggestions (short, impactful phrases for thumbnail)

Optimize for ${platform} platform algorithms and best practices.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a video marketing expert who creates compelling metadata that maximizes views and engagement.');

    const result = {
      metadata: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      platform,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-metadata', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Call-to-Action
app.post('/api/ai/generate-cta', authenticateToken, async (req, res) => {
  try {
    const { review_text, product_service, target_action } = req.body;

    const prompt = `Create compelling calls-to-action for this video testimonial.

Review Context: "${review_text}"
Product/Service: ${product_service}
Desired Action: ${target_action || 'Sign up'}

Generate:
1. On-Screen CTA Text (5 options, under 10 words each)
2. Spoken CTA Script (what the avatar should say at the end)
3. Button Text Options (for video overlay)
4. Urgency Phrases (optional urgency elements)
5. Social Proof Elements (how to reinforce the testimonial message)

Make CTAs feel natural and not overly salesy, matching the authentic testimonial tone.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a conversion optimization expert who creates CTAs that feel natural within testimonial content.');

    const result = {
      cta_options: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-cta', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Translate Review
app.post('/api/ai/translate', authenticateToken, async (req, res) => {
  try {
    const { text, target_language, maintain_tone = true } = req.body;

    const prompt = `Translate this testimonial to ${target_language}.

Original Text: "${text}"

Requirements:
1. Maintain the authentic, personal tone of a customer testimonial
2. Preserve emotional nuances and enthusiasm
3. Adapt cultural references if needed
4. Keep it natural-sounding in the target language
5. Preserve any brand/product names

Provide:
1. The translated text
2. Notes on any cultural adaptations made
3. Pronunciation tips for AI avatar (if applicable)`;

    const aiResponse = await callOpenRouter(prompt, `You are an expert translator specializing in marketing content and testimonials. Translate to ${target_language} while preserving authenticity.`);

    const result = {
      translation: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      target_language,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'translate', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Template Suggestions
app.post('/api/ai/suggest-template', authenticateToken, async (req, res) => {
  try {
    const { review_text, industry, brand_colors, duration_preference } = req.body;

    const prompt = `Suggest video template settings for this testimonial.

Review: "${review_text}"
Industry: ${industry || 'General'}
Brand Colors: ${brand_colors || 'Not specified'}
Preferred Duration: ${duration_preference || '30-60 seconds'}

Recommend:
1. Visual Style (modern, classic, minimalist, bold, etc.)
2. Color Palette (specific hex codes if brand colors not provided)
3. Font Recommendations (heading and body fonts)
4. Animation Style (subtle, dynamic, professional, playful)
5. Background Options (solid, gradient, office, outdoor, abstract)
6. Music Mood (upbeat, inspiring, calm, corporate)
7. Transition Types (fade, slide, zoom, cut)
8. Text Overlay Placement (where to show customer name, company, quotes)

Explain why each recommendation fits this specific testimonial.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a video design expert who creates visually appealing testimonial videos that match brand identity and message.');

    const result = {
      template_suggestions: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'suggest-template', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate complete testimonial package
app.post('/api/ai/generate-package', authenticateToken, async (req, res) => {
  try {
    const { review_text, customer_name, company } = req.body;

    const prompt = `Create a complete video testimonial package based on this review:

Customer: ${customer_name}
Company: ${company}
Review: "${review_text}"

Generate ALL of the following in a structured format:

1. VIDEO SCRIPT (30-60 seconds, natural conversational tone)
2. VIDEO TITLE (3 options, under 60 characters)
3. SHORT DESCRIPTION (150 characters for social media)
4. LONG DESCRIPTION (300 characters for video page)
5. HASHTAGS (10 relevant hashtags)
6. CALL-TO-ACTION (spoken CTA for end of video)
7. THUMBNAIL TEXT (short impactful phrase)
8. AVATAR RECOMMENDATION (demographics, style, attire)
9. TEMPLATE RECOMMENDATION (colors, fonts, animation style)
10. MUSIC MOOD (recommended background music mood)

Format each section clearly with headers.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a complete video marketing expert. Generate comprehensive testimonial packages.');

    const result = {
      package: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-package', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate A/B test variations
app.post('/api/ai/generate-variations', authenticateToken, async (req, res) => {
  try {
    const { script, variation_count = 3 } = req.body;

    const prompt = `Create ${variation_count} A/B test variations of this testimonial script:

Original Script: "${script}"

For each variation:
1. Keep the core message and authenticity
2. Vary the opening hook
3. Adjust the emotional tone slightly
4. Change the call-to-action approach

Label each variation (A, B, C, etc.) and explain the key differences.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an A/B testing expert for video marketing content.');

    const result = {
      variations: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-variations', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== NEW AI FEATURES ====================

// AI Interview Question Generator
app.post('/api/ai/generate-interview-questions', authenticateToken, async (req, res) => {
  try {
    const { topic, industry, difficulty = 'Medium', question_count = 5, context } = req.body;

    const prompt = `Generate ${question_count} interview questions for gathering customer testimonials.

Topic: ${topic}
Industry: ${industry || 'General'}
Difficulty: ${difficulty}
Context: ${context || 'For video testimonials'}

Create questions that:
1. Encourage detailed, authentic responses
2. Are open-ended to allow storytelling
3. Focus on specific experiences and outcomes
4. Are appropriate for video testimonials
5. Progress from easy ice-breakers to deeper insights

For each question, provide:
- The question itself
- Why this question is effective
- Expected type of response
- Follow-up prompts if needed

Format the output with clear sections for each question.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert interviewer who specializes in gathering compelling customer testimonials. Create questions that elicit authentic, video-ready responses.');

    const result = {
      questions: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-interview-questions', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Sports Highlight Clipper
app.post('/api/ai/analyze-sports-highlights', authenticateToken, async (req, res) => {
  try {
    const { video_description, sport_type, duration, context } = req.body;

    const prompt = `Analyze this sports content and identify key highlight moments.

Sport Type: ${sport_type}
Video Duration: ${duration || 'Unknown'}
Video Description: "${video_description}"
Additional Context: ${context || 'None provided'}

Identify and describe:
1. KEY MOMENTS - List the most exciting/important moments with timestamps
2. HIGHLIGHT TYPES - Categorize each (goal, save, dunk, touchdown, etc.)
3. EXCITEMENT LEVEL - Rate each moment 1-100
4. CLIP RECOMMENDATIONS - Suggested start/end times for each clip
5. BEST FOR SOCIAL - Which clips would perform best on social media
6. NARRATIVE ARC - How to sequence clips for maximum impact
7. CAPTION SUGGESTIONS - Text overlays for each highlight
8. MUSIC SYNC POINTS - Where to place music beats for impact

Format with clear sections and timestamps where applicable.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a professional sports video editor with expertise in identifying and clipping the most exciting moments from sports footage.');

    const result = {
      highlights: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'analyze-sports-highlights', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI General Highlight Clipper
app.post('/api/ai/analyze-highlights', authenticateToken, async (req, res) => {
  try {
    const { content_description, content_type, duration, purpose } = req.body;

    const prompt = `Analyze this video content and identify key highlight moments.

Content Type: ${content_type}
Video Duration: ${duration || 'Unknown'}
Content Description: "${content_description}"
Purpose: ${purpose || 'General highlight reel'}

Identify and analyze:
1. KEY MOMENTS - Most important/engaging segments with timestamps
2. CONTENT CATEGORIES - Type of each moment (insight, quote, demonstration, etc.)
3. ENGAGEMENT SCORE - Rate each moment's potential engagement 1-100
4. CLIP RECOMMENDATIONS - Optimal start/end times
5. SOCIAL MEDIA CUTS - Best moments for short-form content
6. QUOTE EXTRACTION - Key quotes worth highlighting
7. THUMBNAIL MOMENTS - Best frames for thumbnails
8. CHAPTER MARKERS - Suggested video chapters

Provide actionable recommendations for video editing.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a professional video editor specializing in identifying compelling moments in various types of content.');

    const result = {
      highlights: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'analyze-highlights', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI B-Roll Suggester
app.post('/api/ai/suggest-broll', authenticateToken, async (req, res) => {
  try {
    const { context, industry, mood, duration, brand_guidelines } = req.body;

    const prompt = `Suggest B-roll footage for this video project.

Context: "${context}"
Industry: ${industry || 'General'}
Mood: ${mood || 'Professional'}
Video Duration: ${duration || '60 seconds'}
Brand Guidelines: ${brand_guidelines || 'Not specified'}

Provide comprehensive B-roll suggestions:

1. PRIMARY B-ROLL SHOTS
   - Shot description
   - Duration recommendation
   - Placement in video

2. SECONDARY B-ROLL
   - Supporting footage ideas
   - Transition shots

3. STOCK FOOTAGE KEYWORDS
   - Exact search terms for stock sites
   - Alternative search terms

4. STOCK SOURCES
   - Recommended platforms (Pexels, Shutterstock, etc.)
   - Free vs paid recommendations

5. STYLE NOTES
   - Color grading suggestions
   - Movement/pacing guidelines
   - Resolution requirements

6. COLOR PALETTE
   - Suggested colors that match mood
   - Hex codes for consistency

7. COMPOSITION TIPS
   - Framing suggestions
   - Aspect ratio considerations

Format with clear categories and specific recommendations.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a video production expert specializing in B-roll selection and visual storytelling.');

    const result = {
      broll_suggestions: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'suggest-broll', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Music Matcher
app.post('/api/ai/suggest-music', authenticateToken, async (req, res) => {
  try {
    const { content_description, mood, duration, genre_preference, energy_level } = req.body;

    const prompt = `Recommend background music for this video project.

Content Description: "${content_description}"
Desired Mood: ${mood || 'Professional'}
Video Duration: ${duration || '60 seconds'}
Genre Preference: ${genre_preference || 'No preference'}
Energy Level: ${energy_level || 'Medium'}

Provide comprehensive music recommendations:

1. PRIMARY TRACK SUGGESTIONS
   - Genre and style
   - Tempo (BPM range)
   - Key signature recommendation
   - Instrumentation suggestions

2. MUSIC CHARACTERISTICS
   - Energy level throughout
   - Build-up moments
   - Drop/climax points

3. SYNC POINTS
   - Where to align beats with visuals
   - Transition timing

4. LICENSING RECOMMENDATIONS
   - Royalty-free options
   - Premium library suggestions
   - Budget considerations

5. SEARCH KEYWORDS
   - Exact terms for music libraries
   - Style descriptors

6. ALTERNATIVE MOODS
   - Backup style options
   - Different energy versions

7. AUDIO MIXING TIPS
   - Volume recommendations
   - Ducking for voiceover
   - Fade in/out timing

Format with clear categories and specific recommendations.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a professional music supervisor with expertise in matching music to video content for maximum emotional impact.');

    const result = {
      music_suggestions: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'suggest-music', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Transcript Generator
app.post('/api/ai/generate-transcript', authenticateToken, async (req, res) => {
  try {
    const { audio_description, context, speakers, language = 'English' } = req.body;

    const prompt = `Generate a professional transcript based on this audio/video description.

Audio Description: "${audio_description}"
Context: ${context || 'General video content'}
Number of Speakers: ${speakers || '1'}
Language: ${language}

Create a comprehensive transcript with:

1. FULL TRANSCRIPT
   - Complete text with speaker labels
   - Paragraph breaks for readability
   - [PAUSE] markers where appropriate

2. TIMESTAMP FORMAT
   - Suggested timestamps (if timeline mentioned)
   - Chapter markers

3. SPEAKER IDENTIFICATION
   - Clear speaker labels
   - Speaker characteristics

4. KEY MOMENTS
   - Important quotes highlighted
   - Significant statements marked

5. SUMMARY
   - Brief overview of content
   - Main topics covered

6. KEYWORDS
   - Key terms mentioned
   - Topics for SEO

7. ACTION ITEMS (if applicable)
   - Any mentioned next steps
   - Call-to-actions

8. QUALITY NOTES
   - Clarity assessment
   - Suggested improvements

Format the transcript professionally with clear formatting.`;

    const aiResponse = await callOpenRouter(prompt, 'You are a professional transcriptionist with expertise in creating accurate, well-formatted transcripts for video content.');

    const result = {
      transcript: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };

    await saveAIGeneration(req.user.id, 'generate-transcript', req.body, result, aiResponse);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD STATS ====================
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const reviews = await pool.query('SELECT COUNT(*) as count FROM reviews');
    const avatars = await pool.query('SELECT COUNT(*) as count FROM avatars');
    const templates = await pool.query('SELECT COUNT(*) as count FROM templates');
    const videos = await pool.query('SELECT COUNT(*) as count FROM videos');
    const scripts = await pool.query('SELECT COUNT(*) as count FROM scripts');
    const voiceovers = await pool.query('SELECT COUNT(*) as count FROM voiceovers');
    const interviewQuestions = await pool.query('SELECT COUNT(*) as count FROM interview_questions');
    const sportsHighlights = await pool.query('SELECT COUNT(*) as count FROM sports_highlights');
    const highlights = await pool.query('SELECT COUNT(*) as count FROM highlights');
    const brollSuggestions = await pool.query('SELECT COUNT(*) as count FROM broll_suggestions');
    const musicMatches = await pool.query('SELECT COUNT(*) as count FROM music_matches');
    const transcripts = await pool.query('SELECT COUNT(*) as count FROM transcripts');

    res.json({
      reviews: parseInt(reviews.rows[0].count),
      avatars: parseInt(avatars.rows[0].count),
      templates: parseInt(templates.rows[0].count),
      videos: parseInt(videos.rows[0].count),
      scripts: parseInt(scripts.rows[0].count),
      voiceovers: parseInt(voiceovers.rows[0].count),
      interviewQuestions: parseInt(interviewQuestions.rows[0].count),
      sportsHighlights: parseInt(sportsHighlights.rows[0].count),
      highlights: parseInt(highlights.rows[0].count),
      brollSuggestions: parseInt(brollSuggestions.rows[0].count),
      musicMatches: parseInt(musicMatches.rows[0].count),
      transcripts: parseInt(transcripts.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VIDEO GENERATION WIZARD ====================
app.post('/api/generate-video', authenticateToken, async (req, res) => {
  try {
    const { review_id, avatar_id, template_id, voiceover_id, options = {} } = req.body;

    const review = await pool.query('SELECT * FROM reviews WHERE id = $1', [review_id]);
    const avatar = await pool.query('SELECT * FROM avatars WHERE id = $1', [avatar_id]);
    const template = await pool.query('SELECT * FROM templates WHERE id = $1', [template_id]);

    if (!review.rows[0] || !avatar.rows[0] || !template.rows[0]) {
      return res.status(400).json({ error: 'Missing required components' });
    }

    const scriptPrompt = `Create a compelling 30-60 second video testimonial script.
Customer: ${review.rows[0].customer_name}
Company: ${review.rows[0].company}
Review: "${review.rows[0].review_text}"

Make it sound natural, conversational, and authentic.`;

    const scriptResponse = await callOpenRouter(scriptPrompt, 'You are an expert testimonial scriptwriter.');
    const generatedScript = scriptResponse.choices[0].message.content;

    const videoTitle = `${review.rows[0].customer_name} - ${review.rows[0].company} Testimonial`;
    const videoResult = await pool.query(
      `INSERT INTO videos (title, review_id, avatar_id, template_id, status, duration)
       VALUES ($1, $2, $3, $4, 'processing', $5) RETURNING *`,
      [videoTitle, review_id, avatar_id, template_id, template.rows[0].duration || 60]
    );

    const scriptResult = await pool.query(
      `INSERT INTO scripts (title, content, tone, word_count, review_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`Script for ${videoTitle}`, generatedScript, 'professional', generatedScript.split(' ').length, review_id]
    );

    setTimeout(async () => {
      await pool.query(
        `UPDATE videos SET status = 'completed', video_url = $1 WHERE id = $2`,
        [`https://example.com/generated-videos/${videoResult.rows[0].id}.mp4`, videoResult.rows[0].id]
      );
    }, 5000);

    res.json({
      success: true,
      video: videoResult.rows[0],
      script: scriptResult.rows[0],
      scriptContent: generatedScript,
      review: review.rows[0],
      avatar: avatar.rows[0],
      template: template.rows[0],
      aiUsage: scriptResponse.usage,
      message: 'Video generation started. Script saved to database.'
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== AVATAR API INTEGRATIONS ====================
app.post('/api/avatars/heygen/generate', authenticateToken, async (req, res) => {
  try {
    const { script, avatar_id, voice_id } = req.body;
    res.json({
      success: true,
      provider: 'HeyGen',
      message: 'Video generation initiated',
      estimated_time: '2-5 minutes',
      job_id: `heygen_${Date.now()}`,
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/avatars/did/generate', authenticateToken, async (req, res) => {
  try {
    const { script, source_url, voice_id } = req.body;
    res.json({
      success: true,
      provider: 'D-ID',
      message: 'Video generation initiated',
      estimated_time: '1-3 minutes',
      job_id: `did_${Date.now()}`,
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/avatars/synthesia/generate', authenticateToken, async (req, res) => {
  try {
    const { script, avatar_id, background } = req.body;
    res.json({
      success: true,
      provider: 'Synthesia',
      message: 'Video generation initiated',
      estimated_time: '3-8 minutes',
      job_id: `synthesia_${Date.now()}`,
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/avatars/:provider/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { provider, jobId } = req.params;
    res.json({
      job_id: jobId,
      provider: provider,
      status: 'completed',
      video_url: `https://example.com/videos/${jobId}.mp4`,
      duration: 45,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS ====================
app.get('/api/analytics/overview', authenticateToken, async (req, res) => {
  try {
    const videosByStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM videos GROUP BY status
    `);

    const reviewsByRating = await pool.query(`
      SELECT rating, COUNT(*) as count
      FROM reviews GROUP BY rating ORDER BY rating
    `);

    const reviewsBySource = await pool.query(`
      SELECT source, COUNT(*) as count
      FROM reviews GROUP BY source ORDER BY count DESC
    `);

    const videosOverTime = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM videos
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    const topCompanies = await pool.query(`
      SELECT company, COUNT(*) as review_count, AVG(rating) as avg_rating
      FROM reviews
      WHERE company IS NOT NULL
      GROUP BY company
      ORDER BY review_count DESC
      LIMIT 10
    `);

    const avatarUsage = await pool.query(`
      SELECT a.name, a.provider, COUNT(v.id) as video_count
      FROM avatars a
      LEFT JOIN videos v ON a.id = v.avatar_id
      GROUP BY a.id, a.name, a.provider
      ORDER BY video_count DESC
      LIMIT 10
    `);

    const templateUsage = await pool.query(`
      SELECT t.name, t.category, COUNT(v.id) as video_count
      FROM templates t
      LEFT JOIN videos v ON t.id = v.template_id
      GROUP BY t.id, t.name, t.category
      ORDER BY video_count DESC
      LIMIT 10
    `);

    res.json({
      videosByStatus: videosByStatus.rows,
      reviewsByRating: reviewsByRating.rows,
      reviewsBySource: reviewsBySource.rows,
      videosOverTime: videosOverTime.rows,
      topCompanies: topCompanies.rows,
      avatarUsage: avatarUsage.rows,
      templateUsage: templateUsage.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USER SETTINGS ====================
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, name',
      [name, email, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/settings/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const validPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== BATCH OPERATIONS ====================
app.post('/api/batch/generate-scripts', authenticateToken, async (req, res) => {
  try {
    const { review_ids, tone = 'professional' } = req.body;

    const results = [];
    for (const review_id of review_ids) {
      const review = await pool.query('SELECT * FROM reviews WHERE id = $1', [review_id]);
      if (review.rows[0]) {
        const prompt = `Create a video testimonial script for:
Customer: ${review.rows[0].customer_name}
Company: ${review.rows[0].company}
Review: "${review.rows[0].review_text}"
Tone: ${tone}`;

        const aiResponse = await callOpenRouter(prompt);
        const script = aiResponse.choices[0].message.content;

        const scriptResult = await pool.query(
          `INSERT INTO scripts (title, content, tone, word_count, review_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [`Script for ${review.rows[0].customer_name}`, script, tone, script.split(' ').length, review_id]
        );

        results.push({ review_id, script: scriptResult.rows[0] });
      }
    }

    res.json({ success: true, generated: results.length, scripts: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/batch/delete', authenticateToken, async (req, res) => {
  try {
    const { type, ids } = req.body;
    const validTypes = ['reviews', 'avatars', 'templates', 'scripts', 'voiceovers', 'videos', 'interview_questions', 'sports_highlights', 'highlights', 'broll_suggestions', 'music_matches', 'transcripts'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    await pool.query(`DELETE FROM ${type} WHERE id = ANY($1)`, [ids]);
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== EXPORT ====================
app.get('/api/export/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['reviews', 'avatars', 'templates', 'scripts', 'voiceovers', 'videos', 'interview_questions', 'sports_highlights', 'highlights', 'broll_suggestions', 'music_matches', 'transcripts'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const tableMap = {
      'interview_questions': 'interview_questions',
      'sports_highlights': 'sports_highlights',
      'broll_suggestions': 'broll_suggestions',
      'music_matches': 'music_matches'
    };

    const tableName = tableMap[type] || type;
    const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${Date.now()}.json`);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Quality Score (apply pass 4 backlog)
app.post('/api/ai/analyze-quality', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY on the server.' });
    }
    const { testimonial_text, format = 'video', target_use = 'marketing website' } = req.body || {};
    if (!testimonial_text) return res.status(400).json({ error: 'testimonial_text is required' });
    const prompt = `Score the testimonial across multiple quality dimensions and return a JSON-only response.
Format: ${format}
Target use: ${target_use}
Testimonial:
"""
${testimonial_text}
"""

Return JSON ONLY:
{
  "overall_score": <0-100>,
  "dimensions": {
    "clarity": <0-100>,
    "specificity": <0-100>,
    "emotional_impact": <0-100>,
    "credibility": <0-100>,
    "structure": <0-100>,
    "length_fit": <0-100>
  },
  "strengths": [string],
  "weaknesses": [string],
  "recommendations": [string],
  "publish_recommendation": "publish|edit|reject"
}`;
    const aiResponse = await callOpenRouter(prompt, 'You are a senior testimonial editor scoring video review quality.');
    const result = {
      quality_analysis: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };
    await saveAIGeneration(req.user.id, 'analyze-quality', req.body, result, aiResponse);
    res.json({ success: true, result });
  } catch (error) {
    if (/OPENROUTER_API_KEY|api[_ ]?key/i.test(error.message || '')) {
      return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY on the server.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// AI Emotion-by-segment analysis (apply pass 4 backlog)
app.post('/api/ai/analyze-emotion', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY on the server.' });
    }
    const { transcript, segment_size = 'sentence', context } = req.body || {};
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });
    const prompt = `Break the transcript into ${segment_size}-level segments and label the emotional tone of each.
Context: ${context || 'video testimonial'}
Transcript:
"""
${transcript}
"""

Return JSON ONLY:
{
  "segments": [
    {
      "index": number,
      "text": string,
      "primary_emotion": "joy|sadness|anger|fear|surprise|trust|anticipation|disgust|neutral",
      "intensity": <0-100>,
      "secondary_emotions": [string],
      "notes": string
    }
  ],
  "emotional_arc": "rising|falling|flat|mixed",
  "peak_segment_index": number,
  "summary": string
}`;
    const aiResponse = await callOpenRouter(prompt, 'You are an expert in narrative emotion analysis for video content.');
    const result = {
      emotion_analysis: aiResponse.choices[0].message.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      generatedAt: new Date().toISOString()
    };
    await saveAIGeneration(req.user.id, 'analyze-emotion', req.body, result, aiResponse);
    res.json({ success: true, result });
  } catch (error) {
    if (/OPENROUTER_API_KEY|api[_ ]?key/i.test(error.message || '')) {
      return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY on the server.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ==================== CSV EXPORT ====================
app.get('/api/export/:type/csv', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['reviews', 'avatars', 'templates', 'scripts', 'voiceovers', 'videos', 'interview_questions', 'sports_highlights', 'highlights', 'broll_suggestions', 'music_matches', 'transcripts'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const tableMap = { 'interview_questions': 'interview_questions', 'sports_highlights': 'sports_highlights', 'broll_suggestions': 'broll_suggestions', 'music_matches': 'music_matches' };
    const tableName = tableMap[type] || type;
    const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
    if (result.rows.length === 0) { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`); return res.send(''); }
    const headers = Object.keys(result.rows[0]);
    const csvRows = [headers.join(',')];
    result.rows.forEach(row => {
      csvRows.push(headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') val = JSON.stringify(val);
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${Date.now()}.csv`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== BULK DELETE PER ENTITY ====================
const bulkDeleteEntities = ['reviews', 'avatars', 'templates', 'scripts', 'voiceovers', 'videos', 'interview-questions', 'sports-highlights', 'highlights', 'broll-suggestions', 'music-matches', 'transcripts'];
bulkDeleteEntities.forEach(entity => {
  const tableName = entity.replace(/-/g, '_');
  app.post(`/api/${entity}/bulk-delete`, authenticateToken, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
      await pool.query(`DELETE FROM ${tableName} WHERE id = ANY($1)`, [ids]);
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// ===== Apply-pass-5 additions =====

// Additive: testimonial_approvals table for approval workflow (TOO-RISKY-only-additive)
let approvalsTableReady = false;
async function ensureApprovalsTable() {
  if (approvalsTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS testimonial_approvals (
      id SERIAL PRIMARY KEY,
      review_id INT,
      submitted_by_user_id INT,
      reviewer_user_id INT,
      status VARCHAR(50) DEFAULT 'pending',
      decision VARCHAR(50),
      notes TEXT,
      decided_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  approvalsTableReady = true;
}

// POST /api/approvals — request approval for a testimonial
app.post('/api/approvals', authenticateToken, async (req, res) => {
  try {
    await ensureApprovalsTable();
    const { review_id, reviewer_user_id, notes } = req.body || {};
    if (!review_id) return res.status(400).json({ error: 'review_id required' });
    const r = await pool.query(
      `INSERT INTO testimonial_approvals (review_id, submitted_by_user_id, reviewer_user_id, notes, status)
       VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
      [review_id, req.user.id, reviewer_user_id || null, notes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/approvals?status=
app.get('/api/approvals', authenticateToken, async (req, res) => {
  try {
    await ensureApprovalsTable();
    const { status, review_id } = req.query;
    let q = 'SELECT * FROM testimonial_approvals';
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (review_id) { params.push(review_id); where.push(`review_id = $${params.length}`); }
    if (where.length) q += ' WHERE ' + where.join(' AND ');
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/approvals/:id — record a decision
app.patch('/api/approvals/:id', authenticateToken, async (req, res) => {
  try {
    await ensureApprovalsTable();
    const { decision, notes } = req.body || {};
    if (!decision || !['approved', 'rejected', 'changes_requested'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approved|rejected|changes_requested' });
    }
    const r = await pool.query(
      `UPDATE testimonial_approvals
       SET status = 'decided', decision = $1, notes = COALESCE($2, notes), reviewer_user_id = $3, decided_at = NOW()
       WHERE id = $4 RETURNING *`,
      [decision, notes || null, req.user.id, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/vimeo/upload
// NEEDS-CREDS — env vars:
//   - VIMEO_ACCESS_TOKEN (personal access token with upload scope)
// Returns 503 + missing when unset.
app.post('/api/integrations/vimeo/upload', authenticateToken, async (req, res) => {
  if (!process.env.VIMEO_ACCESS_TOKEN) {
    return res.status(503).json({
      error: 'Vimeo integration not configured.',
      missing: 'VIMEO_ACCESS_TOKEN',
      documentation: 'Set VIMEO_ACCESS_TOKEN with upload scope to enable this feature.'
    });
  }
  const { video_id, title, description } = req.body || {};
  if (!video_id) return res.status(400).json({ error: 'video_id required' });
  // Vendor SDK call intentionally not wired in this additive pass.
  res.status(501).json({ error: 'Vimeo adapter not implemented; credential is set but vendor call has not been wired.', video_id, title, description });
});

// POST /api/integrations/youtube/upload
// NEEDS-CREDS — env vars:
//   - YOUTUBE_API_KEY
//   - YOUTUBE_CLIENT_ID
//   - YOUTUBE_CLIENT_SECRET
app.post('/api/integrations/youtube/upload', authenticateToken, async (req, res) => {
  const required = ['YOUTUBE_API_KEY', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    return res.status(503).json({
      error: 'YouTube integration not configured.',
      missing: missing.join(','),
      documentation: 'Set YOUTUBE_API_KEY, YOUTUBE_CLIENT_ID, and YOUTUBE_CLIENT_SECRET (OAuth 2.0).'
    });
  }
  const { video_id, title, description, privacy_status } = req.body || {};
  if (!video_id) return res.status(400).json({ error: 'video_id required' });
  res.status(501).json({ error: 'YouTube adapter not implemented; credentials set but vendor call has not been wired.', video_id, title, description, privacy_status: privacy_status || 'unlisted' });
});

// POST /api/recording-portal/issue-token
// PRODUCT-DECISION: rather than building a full self-service web recording UI,
// issue a short-lived JWT (15 min) bound to a review_id that a future portal
// page can present to upload via existing /api/reviews endpoints.
app.post('/api/recording-portal/issue-token', authenticateToken, async (req, res) => {
  try {
    const { review_id, expires_minutes } = req.body || {};
    if (!review_id) return res.status(400).json({ error: 'review_id required' });
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Recording portal not configured.', missing: 'JWT_SECRET' });
    }
    const ttl = Math.min(Math.max(parseInt(expires_minutes, 10) || 15, 1), 120);
    const token = jwt.sign(
      { kind: 'recording_portal', review_id, issued_by: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: `${ttl}m` }
    );
    res.json({
      token,
      review_id,
      expires_in_minutes: ttl,
      portal_url_hint: `/recording-portal?token=${token}&review_id=${review_id}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/testimonial-quality-scorer', require('./routes/testimonialQualityScorer')); app.use('/api/emotion-body-language', require('./routes/emotionBodyLanguage')); app.use('/api/auto-editing-assistant', require('./routes/autoEditingAssistant')); app.use('/api/sentiment-transcription', require('./routes/sentimentTranscription')); app.use('/api/campaign-optimizer', require('./routes/campaignOptimizer')); app.use('/api/realtime-recording-coach', require('./routes/realtimeRecordingCoach'));


// === Batch 08 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-is-actually-substantial-18-endpoints-tsv-claim', require('./routes/gapAiIsActuallySubstantial18EndpointsTsvClaim'));
app.use('/api/gap-no-vision-based-body-language-analysis-beyond-emotion', require('./routes/gapNoVisionBasedBodyLanguageAnalysisBeyondEmotion'));
app.use('/api/gap-no-real-time-recording-coach-during-capture', require('./routes/gapNoRealTimeRecordingCoachDuringCapture'));
app.use('/api/gap-no-native-linkedin-tiktok-publishing', require('./routes/gapNoNativeLinkedinTiktokPublishing'));
app.use('/api/gap-no-collaboration-commenting-on-draft-testimonials', require('./routes/gapNoCollaborationCommentingOnDraftTestimonials'));
app.use('/api/gap-limited-multi-approver-workflow-single-approvals-route', require('./routes/gapLimitedMultiApproverWorkflowSingleApprovalsRoute'));
app.use('/api/gap-no-webhook-notifications-for-approval-state-changes', require('./routes/gapNoWebhookNotificationsForApprovalStateChanges'));
app.use('/api/gap-no-multi-tenant-white-label-support', require('./routes/gapNoMultiTenantWhiteLabelSupport'));

// Custom Views (mounted before any 404 handler)
app.use('/api/custom-views', require('./routes/customViews'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
