const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'project-management-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
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
  req.session.destroy();
  res.json({ success: true, message: 'ログアウトしました' });
});

app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run("INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
    [username, hashedPassword, email], function(err) {
      if (err) {
        res.status(400).json({ error: 'ユーザー登録に失敗しました' });
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