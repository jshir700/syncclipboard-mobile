# SyncClipboard iOS Shortcut

Open → auto-upload. Menu shows recent history + current clipboard. Tap to copy.

---

## Menu

```
hello world this is my clipboard text...    ← 刚刚自动上传 + 拉取确认
meeting link https://meet.google.com/abc    ← 上一次的剪贴板
important address 123 Main Street           ← 再上一次
───────────────────────────────
🔄 Refresh  │  ⚙️ Open App
```

- 点**任意一行文字** → 复制那条内容到剪贴板
- `🔄 Refresh` → 重新运行（上传当前剪贴板 + 拉取远端）
- `⚙️ Open App` → 打开 SyncClipboard App

历史记录存 iCloud `Shortcuts/syncclipboard_history.json`，默认保留最近 **10** 条。

---

## Building the Shortcut

### Config Dictionary

| Key          | Value                                        |
| ------------ | -------------------------------------------- |
| `server`     | `your-server.com:5033`                       |
| `user`       | `admin`                                      |
| `authPass`   | `your-auth-password`                         |
| `cryptoPass` | `your-encryption-password` (empty = no E2EE) |

### Step 1: Auth

| #   | Action            | Details             |
| --- | ----------------- | ------------------- |
| 1   | **Dictionary**    | Config above        |
| 2   | **Text**          | `{user}:{authPass}` |
| 3   | **Base64 Encode** | Text from step 2    |
| 4   | **Text**          | `Basic {Base64}`    |
| 5   | **Set Variable**  | Name: `auth`        |

### Step 2: Fetch Remote

| #   | Action                  | Details                                                                                                               |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 6   | **Text**                | `https://{server}/SyncClipboard.json`                                                                                 |
| 7   | **URL**                 | Text                                                                                                                  |
| 8   | **Get Contents of URL** | Method: GET, Headers: `Authorization`=`{auth}`                                                                        |
| 9   | **Set Variable**        | Name: `json`                                                                                                          |
| 10  | **If**                  | `{json.encrypted}` `is` `1` or `true`                                                                                 |
| 11  | └─ **URL**              | `syncclipboard://decrypt?text={json.text}&password={cryptoPass}&callback=shortcuts://run-shortcut?name=SyncClipboard` |
| 12  | └─ **Open URL**         | (app decrypts, returns)                                                                                               |
| 13  | └─ **Get Clipboard**    |                                                                                                                       |
| 14  | └─ **Set Variable**     | Name: `remote`                                                                                                        |
| 15  | **Otherwise**           |                                                                                                                       |
| 16  | └─ **Set Variable**     | Name: `remote`, Value: `{json.text}`                                                                                  |
| 17  | **End If**              |                                                                                                                       |

### Step 3: Read Local Clipboard

| #   | Action            | Details          |
| --- | ----------------- | ---------------- |
| 18  | **Get Clipboard** |                  |
| 19  | **Set Variable**  | Name: `clipText` |

### Step 4: Upload if different from remote

| #   | Action                     | Details                                                                                                              |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 20  | **If**                     | `{clipText}` `is not` `{remote}` AND `{clipText}` `has any value`                                                    |
| 21  | └─ **If**                  | `{cryptoPass}` `has any value`                                                                                       |
| 22  | └─── **URL**               | `syncclipboard://encrypt?text={clipText}&password={cryptoPass}&callback=shortcuts://run-shortcut?name=SyncClipboard` |
| 23  | └─── **Open URL**          |                                                                                                                      |
| 24  | └─── **Get Clipboard**     | (encrypted base64)                                                                                                   |
| 25  | └─── **Set Variable**      | Name: `uploadText`                                                                                                   |
| 26  | └─── **Number**            | `1`                                                                                                                  |
| 27  | └─── **Set Variable**      | Name: `enc`                                                                                                          |
| 28  | └─ **Otherwise**           |                                                                                                                      |
| 29  | └─── **Set Variable**      | Name: `uploadText`, Value: `{clipText}`                                                                              |
| 30  | └─── **Text**              | `0`                                                                                                                  |
| 31  | └─── **Set Variable**      | Name: `enc`                                                                                                          |
| 32  | └─ **End If**              |                                                                                                                      |
| 33  | └─ **Dictionary**          | `type`=`Text`, `text`=`{uploadText}`, `hasData`=false, `encrypted`=`{enc}`                                           |
| 34  | └─ **Text**                | `https://{server}/SyncClipboard.json`                                                                                |
| 35  | └─ **URL**                 | Text                                                                                                                 |
| 36  | └─ **Get Contents of URL** | Method: PUT, Body: JSON {Dictionary}, Headers: `Authorization`=`{auth}`, `Content-Type`=`application/json`           |
| 37  | **End If**                 |                                                                                                                      |

### Step 5: Read Max History (from config file)

| #   | Action                              | Details                                     |
| --- | ----------------------------------- | ------------------------------------------- |
| 38  | **Get File**                        | Path: `Shortcuts/syncclipboard_config.json` |
| 39  | **If**                              | `{File}` `has any value`                    |
| 40  | └─ **Get Dictionary from** `{File}` |                                             |
| 41  | └─ **Get Value for** `maxHistory`   |                                             |
| 42  | **Otherwise**                       |                                             |
| 43  | └─ **Number**                       | `10` (default)                              |
| 44  | **End If**                          |                                             |
| 45  | **Set Variable**                    | Name: `maxHistory`                          |

### Step 6: Update History

| #   | Action                              | Details                                                             |
| --- | ----------------------------------- | ------------------------------------------------------------------- |
| 46  | **Get File**                        | Path: `Shortcuts/syncclipboard_history.json`                        |
| 47  | **If**                              | `{File}` `has any value`                                            |
| 48  | └─ **Get Dictionary from** `{File}` |                                                                     |
| 49  | └─ **Get Value for** `entries`      |                                                                     |
| 50  | **Otherwise**                       |                                                                     |
| 51  | └─ **Text**                         | (nothing)                                                           |
| 52  | **End If**                          |                                                                     |
| 53  | **Set Variable**                    | Name: `history`                                                     |
| 54  | **Text**                            | `{clipText}`                                                        |
| 55  | **Add to Variable**                 | Prepend to `history`                                                |
| 56  | **Get Items from List**             | First `{maxHistory}` of `{history}`                                 |
| 57  | **Set Variable**                    | Name: `history`                                                     |
| 58  | **Dictionary**                      | `entries` = `{history}`                                             |
| 59  | **Save File**                       | Path: `Shortcuts/syncclipboard_history.json`, Content: {Dictionary} |

### Step 7: Build Menu

| #   | Action               | Details                                                                                    |
| --- | -------------------- | ------------------------------------------------------------------------------------------ |
| 52  | **Set Variable**     | Name: `menuItems`, Value: `{history}` (all entries as text lines, each truncated 50 chars) |
| 53  | **Text**             | `────────────────────`                                                                     |
| 54  | **Add to Variable**  | `menuItems`                                                                                |
| 55  | **Text**             | `🔄 Refresh`                                                                               |
| 56  | **Add to Variable**  | `menuItems`                                                                                |
| 57  | **Text**             | `⚙️ Open App`                                                                              |
| 58  | **Add to Variable**  | `menuItems`                                                                                |
| 61  | **Choose from List** | Items: `{menuItems}`                                                                       |

### Step 8: Handle Tap

| #   | Action                   | Details                             |
| --- | ------------------------ | ----------------------------------- |
| 62  | **If**                   | `{Chosen Item}` `is` `📋 Clipboard` |
| 63  | └─ **Copy to Clipboard** | `{clipText}`                        |
| 64  | **End If**               |                                     |
| 65  | **If**                   | `{Chosen Item}` `is` `⚙️ Open App`  |
| 66  | └─ **Open URL**          | `syncclipboard://`                  |
| 67  | └─ **Exit Shortcut**     |                                     |
| 68  | **End If**               |                                     |
| 69  | **If**                   | `{Chosen Item}` `is` `🔄 Refresh`   |
| 70  | └─ **Nothing**           | (fall through)                      |
| 71  | **Otherwise**            | (history item was tapped)           |
| 72  | └─ **Copy to Clipboard** | `{Chosen Item}`                     |
| 73  | **End If**               |                                     |
| 74  | **Run Shortcut**         | `SyncClipboard` (loop back)         |

---

## App Integration: Modify Max History Count

The app writes `Shortcuts/syncclipboard_config.json` to iCloud:

```json
{ "maxHistory": 10 }
```

The Shortcut reads this file each run. Change the value in the app settings and it takes effect immediately.

To implement in the app: add a settings item → write to `FileManager.default.url(forUbiquityContainerIdentifier: ...)` → `Shortcuts/syncclipboard_config.json`.
