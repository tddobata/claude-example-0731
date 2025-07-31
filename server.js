const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'ログイン試行回数が上限を超えました。15分後に再試行してください。'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for registration
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 registration attempts per hour
  message: {
    error: 'ユーザー登録試行回数が上限を超えました。1時間後に再試行してください。'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  }
}));

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('データベース接続エラー:', err.message);
  } else {
    console.log('SQLiteデータベースに接続しました。');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planning',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      user_id INTEGER,
      date DATE NOT NULL,
      content TEXT NOT NULL,
      progress_percentage INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    const defaultUser = {
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      email: 'admin@example.com'
    };

    db.get("SELECT id FROM users WHERE username = ?", [defaultUser.username], (err, row) => {
      if (!row) {
        db.run("INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
          [defaultUser.username, defaultUser.password, defaultUser.email]);
        console.log('デフォルトユーザー (admin/admin123) を作成しました。');
      }
    });
  });
}

function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'ログインが必要です' });
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  
  // Input validation
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
  }
  
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '無効な入力形式です' });
  }
  
  if (username.length > 50 || password.length > 100) {
    return res.status(400).json({ error: '入力値が長すぎます' });
  }
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'データベースエラー' });
    }
    
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ success: true, message: 'ログイン成功', user: { id: user.id, username: user.username } });
    } else {
      res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('セッション破棄エラー:', err);
      return res.status(500).json({ error: 'ログアウトに失敗しました' });
    }
    res.json({ success: true, message: 'ログアウトしました' });
  });
});

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'パスワードは8文字以上である必要があります';
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return 'パスワードには小文字を含める必要があります';
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return 'パスワードには大文字を含める必要があります';
  }
  if (!/(?=.*\d)/.test(password)) {
    return 'パスワードには数字を含める必要があります';
  }
  return null;
}

function validateInput(username, password, email) {
  if (!username || username.length < 3) {
    return 'ユーザー名は3文字以上である必要があります';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'ユーザー名には英数字とアンダースコアのみ使用できます';
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return '有効なメールアドレスを入力してください';
  }
  return validatePassword(password);
}

app.post('/api/register', registerLimiter, (req, res) => {
  const { username, password, email } = req.body;
  
  const validationError = validateInput(username, password, email);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run("INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
    [username, hashedPassword, email], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'ユーザー名またはメールアドレスが既に使用されています' });
        } else {
          res.status(500).json({ error: 'ユーザー登録に失敗しました' });
        }
      } else {
        res.json({ success: true, message: 'ユーザー登録が完了しました', userId: this.lastID });
      }
    });
});

app.get('/api/projects', requireAuth, (req, res) => {
  db.all(`SELECT p.*, u.username as created_by_name 
          FROM projects p 
          LEFT JOIN users u ON p.created_by = u.id 
          ORDER BY p.updated_at DESC`, (err, projects) => {
    if (err) {
      res.status(500).json({ error: 'プロジェクト取得エラー' });
    } else {
      res.json(projects);
    }
  });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { name, description, status } = req.body;
  
  db.run("INSERT INTO projects (name, description, status, created_by) VALUES (?, ?, ?, ?)",
    [name, description, status || 'planning', req.session.userId], function(err) {
      if (err) {
        res.status(500).json({ error: 'プロジェクト作成エラー' });
      } else {
        res.json({ success: true, message: 'プロジェクトを作成しました', projectId: this.lastID });
      }
    });
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const { name, description, status } = req.body;
  const projectId = req.params.id;
  
  db.run("UPDATE projects SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, description, status, projectId], function(err) {
      if (err) {
        res.status(500).json({ error: 'プロジェクト更新エラー' });
      } else {
        res.json({ success: true, message: 'プロジェクトを更新しました' });
      }
    });
});

app.get('/api/projects/:id/reports', requireAuth, (req, res) => {
  const projectId = req.params.id;
  
  db.all(`SELECT dr.*, u.username 
          FROM daily_reports dr 
          LEFT JOIN users u ON dr.user_id = u.id 
          WHERE dr.project_id = ? 
          ORDER BY dr.date DESC`, [projectId], (err, reports) => {
    if (err) {
      res.status(500).json({ error: '日報取得エラー' });
    } else {
      res.json(reports);
    }
  });
});

app.post('/api/projects/:id/reports', requireAuth, (req, res) => {
  const { date, content, progress_percentage } = req.body;
  const projectId = req.params.id;
  
  db.run("INSERT INTO daily_reports (project_id, user_id, date, content, progress_percentage) VALUES (?, ?, ?, ?, ?)",
    [projectId, req.session.userId, date, content, progress_percentage || 0], function(err) {
      if (err) {
        res.status(500).json({ error: '日報投稿エラー' });
      } else {
        res.json({ success: true, message: '日報を投稿しました', reportId: this.lastID });
      }
    });
});

app.get('/api/user', requireAuth, (req, res) => {
  res.json({ 
    id: req.session.userId, 
    username: req.session.username 
  });
});

app.listen(PORT, () => {
  console.log(`サーバーがポート${PORT}で起動しました`);
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('データベース接続を閉じました。');
    process.exit(0);
  });
});