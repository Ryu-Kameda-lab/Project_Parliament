# Project_Parliament
# 🏛️ Project Parliament

複数のAIサービスを1つのWeb上で連結し、仮想通貨取引戦略を議論させるサービス。

## 概要

Project Parliamentは、ChatGPT・Gemini・Codex・Claudeの4つのAIを仮想的な「議会」として機能させ、
仮想通貨のチャート分析と取引戦略の策定を行うWebアプリケーションです。

### 業務フロー

```
ユーザー → チャート画像アップロード → 全AI分析・議論開始
                                          ↓
                                    AIが稟議書を提出
                                          ↓
                                    他AIが投票（賛成/反対）
                                          ↓
                                   満場一致 → ブラッシュアップ
                                          ↓
                                    最終稟議書ダウンロード → 終了
```

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/YOUR_USERNAME/Project_Parliament.git
cd Project_Parliament
```

### 2. Python仮想環境の作成

```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows
```

### 3. パッケージのインストール

```bash
pip install -r requirements.txt
```

### 4. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集し、各APIキーを設定
```

### 5. 起動

```bash
python app.py
```

ブラウザで `http://localhost:5000` にアクセス。

## プロジェクト構成

```
Project_Parliament/
├── app.py                  # メインアプリ（Flask + SocketIO）
├── config.py               # 設定ファイル
├── requirements.txt        # Pythonパッケージ
├── .env.example            # 環境変数テンプレート
├── modules/
│   ├── __init__.py
│   ├── ai_clients.py       # AI接続モジュール
│   └── discussion_engine.py # 議論エンジン
├── templates/
│   └── index.html          # メインUI（Teams風）
├── static/
│   ├── css/
│   │   └── style.css       # スタイルシート
│   ├── js/
│   │   └── main.js         # フロントエンドJS
│   └── images/
└── README.md
```

## 使用技術

| 技術 | 用途 |
|------|------|
| Python / Flask | Webバックエンド |
| Flask-SocketIO | リアルタイム通信 |
| HTML / CSS / JS | フロントエンドUI |
| OpenAI API | ChatGPT / Codex |
| Google AI API | Gemini |
| Anthropic API | Claude |

## 注意事項

- **データ保管なし**: 議論データはサービス終了時に全て破棄されます
- **取引判断**: 最終的な取引判断はユーザーが行い、AIは実際の取引を行いません
- **利用者**: 管理人1名のみの利用を想定しています

