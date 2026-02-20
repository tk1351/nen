# nen

zsh ターミナル上でコマンド入力中にインラインサジェスト（fig / zsh-autosuggestions スタイル）を表示する macOS 専用 CLI ツール。

## アーキテクチャ

```
zsh (ZLE Widget) ──────── UNIX Socket ──────── Deno Daemon
  ・zpty で非同期通信        /tmp/nen.sock          ・history 読み込み
  ・ghost text 表示                                 ・PATH スキャン
  ・dropdown 表示                                   ・SQLite キャッシュ
  ・↓↑Enter/Esc/→ 操作                             ・fuzzy マッチング
  ・危険コマンド警告表示                             ・セキュリティチェック
```

- **ZSH側** は `curl --unix-socket` で Deno daemon にリクエスト（macOS 標準 curl 8.x のみ依存）
- **Deno daemon** は LaunchAgent で常駐起動、fallback は curl タイムアウト 100ms で無音失敗
- **IPC**: HTTP/1.1 over UNIX socket（`Deno.serve({ path })`）

## 要件

- macOS (aarch64)
- Deno v2.x
- zsh

## セットアップ

```bash
# 開発用起動
deno task dev

# テスト実行
deno task test

# ネイティブバイナリコンパイル
deno task compile

# インストール（LaunchAgent 登録 + .zshrc 設定）
deno task install
```

## 開発

### TDD 実装順序

1. `src/security/guard.ts` — 危険コマンド検出（pure function）
2. `src/matcher/fuzzy.ts` — fuzzy スコアリング（pure function）
3. `src/history/reader.ts` — ~/.zsh_history パーサー
4. `src/commands/scanner.ts` — PATH コマンドスキャナー
5. `src/cache/store.ts` — SQLite キャッシュ
6. `src/server/handler.ts` — HTTP リクエストハンドラー
7. `src/main.ts` — Daemon エントリーポイント
8. `shell/nen.zsh` — ZLE ウィジェット
9. `scripts/install.ts` — インストーラー

### セキュリティ対策

| パターン | 理由 | 深刻度 |
|---------|------|--------|
| `rm -rf /`, `rm -rf ~` 等 | ルート/ホーム削除 | critical |
| `:(){:\|:&};:` | fork bomb | critical |
| `dd if=... of=/dev/sd*` | ディスク上書き | critical |
| `sudo` | 特権昇格 | high |
| `chmod [0-7]*7[0-7]{2}` | world-writable | high |
| `DROP TABLE/DATABASE` | SQL破壊 | high |
| `rm -r` | 再帰削除 | medium |
| `curl/wget \| sh` | インターネットからシェル実行 | low |

## ファイル構成

```
nen/
├── deno.json
├── .gitignore
├── README.md
├── src/
│   ├── main.ts
│   ├── types.ts
│   ├── history/
│   │   ├── reader.ts
│   │   └── reader.test.ts
│   ├── commands/
│   │   ├── scanner.ts
│   │   └── scanner.test.ts
│   ├── cache/
│   │   ├── store.ts
│   │   └── store.test.ts
│   ├── matcher/
│   │   ├── fuzzy.ts
│   │   └── fuzzy.test.ts
│   ├── security/
│   │   ├── guard.ts
│   │   └── guard.test.ts
│   └── server/
│       ├── handler.ts
│       └── handler.test.ts
├── shell/
│   └── nen.zsh
├── scripts/
│   └── install.ts
└── launchd/
    └── com.nen.daemon.plist
```

## ライセンス

MIT
