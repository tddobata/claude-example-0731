# 案件管理システム

HTML/JS + Node.js + SQLiteを使用したシステム開発案件の状況管理システムです。

## 機能

- **ユーザー認証**: ログイン・ユーザー登録機能
- **案件管理**: 案件の作成・編集・一覧表示
- **進捗管理**: ステータス管理（企画中、進行中、テスト中、完了、保留）
- **日報機能**: プロジェクトごとの作業日報投稿・閲覧
- **複数ユーザー対応**: アカウント管理による複数人での利用

## 技術スタック

- **フロントエンド**: HTML, CSS, JavaScript (Vanilla)
- **バックエンド**: Node.js, Express.js
- **データベース**: SQLite3
- **認証**: bcryptjs, express-session

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. サーバーの起動:
```bash
npm start
```

3. ブラウザで http://localhost:3000 にアクセス

## デフォルトユーザー

初回起動時に以下のデフォルトユーザーが作成されます：
- ユーザー名: `admin`
- パスワード: `admin123`

## 使用方法

### 1. ログイン
- デフォルトユーザー、または新規登録したユーザーでログイン

### 2. 案件管理
- 「案件作成」タブから新しい案件を作成
- 案件一覧から既存案件の確認・編集
- ステータス管理（企画中→進行中→テスト中→完了）

### 3. 日報機能
- 「日報」タブでプロジェクトを選択
- 日付、作業内容、進捗率を入力して日報を投稿
- 過去の日報履歴を時系列で確認

## ファイル構成

```
├── server.js          # Express サーバー
├── package.json       # プロジェクト設定
├── database.db        # SQLite データベース（自動生成）
├── test.js           # テストスクリプト
└── public/           # 静的ファイル
    ├── index.html    # メインHTML
    ├── style.css     # スタイルシート
    └── script.js     # フロントエンドJS
```

## データベース構造

### users テーブル
- id: ユーザーID（主キー）
- username: ユーザー名
- password: ハッシュ化パスワード
- email: メールアドレス
- created_at: 作成日時

### projects テーブル
- id: プロジェクトID（主キー）
- name: プロジェクト名
- description: プロジェクト概要
- status: ステータス
- created_by: 作成者ID
- created_at: 作成日時
- updated_at: 更新日時

### daily_reports テーブル
- id: 日報ID（主キー）
- project_id: プロジェクトID
- user_id: ユーザーID
- date: 日付
- content: 作業内容
- progress_percentage: 進捗率
- created_at: 作成日時

## テスト

テストスクリプトを実行してシステムの動作を確認：

```bash
npm test
```

## 開発モード

開発時はnodemonを使用してファイル変更時の自動再起動が可能：

```bash
npm run dev
```

## セキュリティ

- パスワードはbcryptjsでハッシュ化
- セッション管理によるログイン状態の維持
- SQLインジェクション対策済み

## ライセンス

MIT