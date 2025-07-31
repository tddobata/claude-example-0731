const http = require('http');
const path = require('path');

function testServer() {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    }, (res) => {
      if (res.statusCode === 200) {
        console.log('✓ サーバーが正常に起動しています');
        resolve(true);
      } else {
        console.log('✗ サーバーエラー:', res.statusCode);
        resolve(false);
      }
    });

    request.on('error', (err) => {
      console.log('✗ サーバー接続エラー:', err.message);
      resolve(false);
    });

    request.setTimeout(5000, () => {
      console.log('✗ サーバー接続タイムアウト');
      resolve(false);
    });

    request.end();
  });
}

async function runTests() {
  console.log('=== 案件管理システム テスト ===');
  
  console.log('\n1. ファイル存在確認...');
  const fs = require('fs');
  const requiredFiles = [
    'server.js',
    'package.json',
    'public/index.html',
    'public/style.css',
    'public/script.js'
  ];
  
  let filesOk = true;
  requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✓ ${file} が存在します`);
    } else {
      console.log(`✗ ${file} が見つかりません`);
      filesOk = false;
    }
  });

  console.log('\n2. package.json 確認...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['express', 'sqlite3', 'bcryptjs', 'express-session', 'body-parser'];
    
    requiredDeps.forEach(dep => {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        console.log(`✓ ${dep} が依存関係に含まれています`);
      } else {
        console.log(`✗ ${dep} が依存関係に含まれていません`);
        filesOk = false;
      }
    });
  } catch (err) {
    console.log('✗ package.json の読み込みエラー:', err.message);
    filesOk = false;
  }

  console.log('\n3. サーバー起動テスト...');
  console.log('注意: このテストを実行するには、別のターミナルで "npm start" を実行してください');
  
  const serverRunning = await testServer();
  
  console.log('\n=== テスト結果 ===');
  if (filesOk && serverRunning) {
    console.log('✓ すべてのテストが成功しました！');
    console.log('\n使用方法:');
    console.log('1. npm install で依存関係をインストール');
    console.log('2. npm start でサーバーを起動');
    console.log('3. http://localhost:3000 にアクセス');
    console.log('4. デフォルトユーザー: admin / admin123');
  } else if (filesOk) {
    console.log('✓ ファイル構成は正常です');
    console.log('サーバーを起動してからテストを再実行してください');
  } else {
    console.log('✗ ファイル構成に問題があります');
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };