# 大江湖 · 美術待生成清單（給 Codex）

這份檔案是美術工作佇列。Codex 請直接照這裡的指令生成圖片，不用再等人轉貼。

## Codex 工作流程（以這裡為準；用戶給的指令只叫你照這段做）
1. 從上往下，找狀態是「待生成」或「待重新生成」的項目。其他狀態（已推送、已存在、暫不需要、暫緩）一律不要做。
2. **「待生成」**：先檢查該項列出的檔案是否都已在 main 分支。都已存在就不要重做，把狀態改成「已存在（日期），略過」。
3. **「待重新生成」**：檔案已存在也要重做，**直接覆蓋同名檔案**。
4. 依「共通規則」和該項目的指令生成圖片，存到指定路徑與檔名。
5. 生成後**自己 commit 並 push 到 GitHub 的 main 分支**，不要只給預覽。
6. 把該項目的狀態改成「已推送（日期）」，跟圖片一起 push。
7. 不要改 `game.js`。圖推上去後，由 Claude 接進遊戲（遊戲目前用暫代圖）。
8. 全部做完，用中文回覆一份清單：每項的編號、狀態、檔名；沒做的寫明原因。

## 共通規則（每一項都適用）
- 先看參考圖：`assets/characters/hero_front.png`、`assets/characters/hero_walk_front.png`（主角）、`assets/reference/town_style_ref.png`（鎮內色調與像素顆粒）。
- 像素風，和主角**同一個視角**（約 45° 俯視、略往下看），同樣的**粗像素顆粒**、粗深色輪廓、硬邊緣、不要抗鋸齒、不要漸層模糊。
- 低飽和但不陰沉；建築與道具偏明亮。
- 背景一律純洋紅 `#FF00FF`（遊戲會把洋紅去掉）。
- **不要縮小或降低圖片解析度**，按指定尺寸直接輸出。
- 角色站姿不要僵硬；走路格要沿用 `assets/templates/` 的姿勢模版，同一高度、同一地面線、同一水平位置。
- **站立圖（stand）雙腿不能靠攏並在一起**（用戶 2026-11-14 規定，所有人物都適用）：以主角 `hero_front.png`、`hero_side.png`、`hero_back.png` 為標準。正面與背面：兩腳分開約與肩同寬，中間看得到空隙。側面：兩腳一前一後分開，看得出是兩隻腳，不要疊成一隻。
- 站立圖規格：每張 1024×1024，人物置中、腳底貼近下緣，身高比例與同一角色的走路圖一致。
- **人物一律用 Agent Sprite Forge 製作**（用戶 2026-11-15 定案，之後所有人物都照這樣）：github.com/0x0funky/agent-sprite-forge，用 **Pixel 模式**（顏色少、硬邊、不抗鋸齒）。先定一張「定稿圖」，再長出走路與站立。
- **人物風格基準**：主角 `hero_front.png`、`hero_walk_front.png`，以及試做成功的劉備 `npc_liubei_forge_stand_front.png`、`npc_liubei_forge_walk_front.png`。粗像素顆粒、粗深色輪廓、低飽和、細節少；**不要比這兩個角色更鮮豔、更精細、對比更強**，金邊、花紋、高光都要少。
- 完成回報要說明實際用了哪種生成方式；如果工具退回成「程式畫的圖」要明說。
- 圖中不要出現文字。

---

## 1. 劉備 走路圖　狀態：已推送（2026-11-14）
### 1b. 劉備 站立圖　狀態：已推送（2026-11-14）
- 檔名：`assets/characters/npc_liubei_stand_front.png`、`npc_liubei_stand_side.png`、`npc_liubei_stand_back.png`（側面朝右）
- 造型與第 1 項的走路圖完全相同（參考 `npc_liubei_walk_*.png`），照共通規則的站立圖規定。神情溫和，一手自然垂下或輕扶腰帶。

- 檔名：`assets/characters/npc_liubei_walk_front.png`、`npc_liubei_walk_side.png`、`npc_liubei_walk_back.png`
- 尺寸：每張 2048×512，橫排 4 格（每格 512×512），側面朝右。
- 底稿：`assets/templates/walk_front_template.png`、`walk_back_template.png`，側面參考 `assets/characters/hero_walk_side.png`。身高、比例與主角相同。
- 造型：東漢末年的落魄宗室青年。現代審美、俊朗溫和；長耳垂；淺色布袍加深色外披，腰繫布帶，背後斜背一把雙股劍；頭髮束髻戴布冠。色系米白、淡綠、深棕。

## 2. 關羽 走路圖　狀態：已推送（2026-11-14）
### 2b. 關羽 站立圖　狀態：已推送（2026-11-14）
- 檔名：前綴 `npc_guanyu_stand_`，front、side、back 三張。
- 造型與第 2 項走路圖完全相同（參考 `npc_guanyu_walk_*.png`）。一手撫鬚或垂下，青龍偃月刀立在身側（刀不要超出圖）。

- 檔名：`assets/characters/npc_guanyu_walk_front.png`、`_side.png`、`_back.png`（前綴 `npc_guanyu_walk_`）
- 尺寸與底稿同第 1 項。
- 造型：高大威嚴，比主角高約一成；紅臉、丹鳳眼、長鬚垂到胸口；綠色戰袍，裡面露出深色護甲，綠色頭巾；手持青龍偃月刀（刀身不要超出格子）。現代審美。

## 3. 張飛 走路圖　狀態：已推送（2026-11-14）
### 3b. 張飛 站立圖　狀態：已推送（2026-11-14）
- 檔名：前綴 `npc_zhangfei_stand_`，front、side、back 三張。
- 造型與第 3 項走路圖完全相同（參考 `npc_zhangfei_walk_*.png`）。雙腳張開但一前一後，蛇矛扛在肩上或斜握，神情豪爽。

- 檔名：前綴 `npc_zhangfei_walk_`，三個方向同上。
- 尺寸與底稿同第 1 項。
- 造型：魁梧粗壯，比主角寬；黑臉、豹頭環眼、短硬的落腮鬍；深色短打皮甲、粗布腰帶；手持丈八蛇矛（矛身不要超出格子）。神情豪爽。現代審美。

> 第 1 到 3 項：若「負責人物」的討論串已經做好劉關張，請跳過，並在狀態寫明已用哪個檔案。

## 4. 桃樹（兩種）　狀態：已推送（2026-11-14）
- 檔名：`assets/props/peach_tree_01.png`、`assets/props/peach_tree_02.png`
- 尺寸：每張 1024×1024，樹的底部貼齊圖片下緣附近，置中。
- 參考：`assets/props/forest_tree_01.png`（同樣大小、視角、像素顆粒）。
- 內容：盛開的桃樹，樹冠滿是粉紅與淡粉的桃花，夾一些嫩綠葉，深棕彎曲樹幹。01 較圓潤、02 較高瘦。明亮、春天感。

## 5. 香案（結義用）　狀態：已推送（2026-11-14）
- 檔名：`assets/props/oath_altar.png`
- 尺寸：1024×512，香案置中、貼近下緣。
- 內容：長方形木供桌，鋪紅色桌布（下緣有金邊），桌上正中一個銅香爐插三支香（**不要畫煙**，煙由遊戲程式畫），左右擺三個裝酒的白瓷碗。俯視角度同主角。

## 6. 老農（城外被搶的百姓）　狀態：暫不需要
- 遊戲目前直接用現有的 `npc_farmer_walk_*`，夠用。

## 7. 黃巾兵 重做（森林與城外的普通小兵）　狀態：已推送（2026-11-14）
- 檔名（覆蓋現有檔）：`assets/characters/turban_walk_front.png`、`turban_walk_side.png`、`turban_walk_back.png`
- 尺寸：每張 2048×512，橫排 4 格（每格 512×512），側面朝右。底稿與主角相同：`assets/templates/walk_front_template.png`、`walk_back_template.png`，側面參考 `assets/characters/hero_walk_side.png`。身高、比例、地面線與主角一致。
- 造型：普通黃巾兵，頭戴黃色頭巾，身穿粗布短褐，腰繫布帶，手持鐵刀或木棍（武器不要超出格子）。神情兇悍但不誇張，體格精瘦，比武將小。現代審美，粗深色輪廓。
- 注意：這是普通小兵，不要做成黃巾渠帥（武將）那種盔甲或披風。
- 站立圖（遊戲有用到，必做）：覆蓋 `turban_stand_front.png`、`turban_stand_side.png`、`turban_stand_back.png`，照共通規則的站立圖規定（不能雙腿並排站直）。

## 8. 現有敵人「側面」站立圖 重做（側面雙腿疊在一起）　狀態：已推送（2026-11-14）
- 正面、背面兩腳已分開，不用改。只覆蓋以下**側面**檔案，**造型、服裝、顏色、武器完全照舊**，只把兩腳改成一前一後分開（參考 `hero_side.png`）。每張 1024×1024。
- 官軍精兵：`assets/characters/hansoldier_stand_side.png`（參考同名舊圖）
- 官軍武將：`assets/characters/hangeneral_stand_side.png`（參考同名舊圖）
- 黃巾渠帥：`assets/characters/ytgeneral_stand_side.png`（參考同名舊圖）
- 武將（官軍武將、黃巾渠帥）比主角高約兩成，畫面比例照舊圖。

---

## 10. 劉備 試做版（用 Agent Sprite Forge）　狀態：已推送（2026-11-14）
- 目的：現有劉關張比主角和路人更鮮豔、對比更強、細節更多，站在一起不協調（用戶 2026-11-14）。先用 Agent Sprite Forge（github.com/0x0funky/agent-sprite-forge）試做劉備一個人，看效果再決定要不要三人都重做。**不要覆蓋現有劉備圖**，兩個版本並存方便比較。
- 做法：先定一張「定稿圖」，再用 Agent Sprite Forge 的 **Pixel 模式**（顏色少、硬邊、不抗鋸齒）長出動作。
- **定稿圖的風格以主角為準**：參考 `assets/characters/hero_front.png`、`hero_walk_front.png`。粗像素顆粒、粗深色輪廓、低飽和、細節少。**不要比主角更鮮豔、更精細、對比更強**，金邊、花紋、高光都要減少。
- 造型沿用現有劉備（參考 `npc_liubei_stand_front.png`）：米白淡綠長袍、深色外披、腰繫布帶、背後斜背雙股劍、髮髻戴布冠、長耳垂、神情溫和。身高、比例與主角相同。
- 檔名（新檔，不覆蓋）：
  - 走路：`assets/characters/npc_liubei_forge_walk_front.png`、`_side.png`、`_back.png`，每張 2048×512，4 格各 512×512，側面朝右，沿用 `assets/templates/` 姿勢模版。
  - 站立：`assets/characters/npc_liubei_forge_stand_front.png`、`_side.png`、`_back.png`，每張 1024×1024，兩腳分開（照共通規則）。
- 先只做 walk 和 stand，不做其他動作。
- 完成後的回報要說明：實際用了哪種生成方式（Codex 圖片生成或 API）。如果工具退回成「程式畫的圖」，要明說。

## 11. 關羽 重做（Agent Sprite Forge）　狀態：已推送（2026-11-14）
- 照共通規則的 Agent Sprite Forge 做法與人物風格基準。**不要覆蓋**現有關羽圖。
- 造型沿用現有關羽（參考 `npc_guanyu_stand_front.png`）：比主角高約一成；紅臉、丹鳳眼、長鬚垂到胸口；綠色戰袍、裡面露出深色護甲、綠色頭巾；手持青龍偃月刀（刀不要超出格子）。把現有圖的金邊、龍紋、高光大幅簡化。
- 檔名（新檔）：走路 `assets/characters/npc_guanyu_forge_walk_front.png`、`_side.png`、`_back.png`（2048×512，4 格，側面朝右）；站立 `npc_guanyu_forge_stand_front.png`、`_side.png`、`_back.png`（1024×1024，兩腳分開）。

## 12. 張飛 重做（Agent Sprite Forge）　狀態：待生成
- 照共通規則的 Agent Sprite Forge 做法與人物風格基準。**不要覆蓋**現有張飛圖。
- 造型沿用現有張飛（參考 `npc_zhangfei_stand_front.png`）：魁梧粗壯、比主角寬；黑臉、豹頭環眼、短硬落腮鬍；深色短打皮甲、粗布腰帶；手持丈八蛇矛（矛不要超出格子）。把金色護肩與裝飾大幅簡化。
- 檔名（新檔）：前綴 `npc_zhangfei_forge_walk_`、`npc_zhangfei_forge_stand_`，規格同第 11 項。

## 每次交給 Codex 的指令（固定不變，整段複製）
規則有改，Claude 只改這份檔案，這段指令永遠不用改。
```
請讀取 GitHub 專案 HeroA1998/The-Martial-Arts-World 的 main 分支根目錄 ART_QUEUE.md，完全照檔案裡的「Codex 工作流程」和「共通規則」執行，檔案寫的就是最新規定。
```

---

## 遊戲目前的接入狀況（Claude 記錄）
- 劉備：遊戲已換成 Agent Sprite Forge 版站立圖（v0.22.1）。關羽、張飛：遊戲用第 2、3 項的站立圖，等第 11、12 項做好再換。走路圖已在倉庫，鎮內劇情角色目前都是站著，之後有走動的劇情再用。
- 桃樹、香案：遊戲已換上（v0.21.1），香煙仍由程式畫。
- 鄒靖：暫用官軍武將圖。老農：用農夫圖。
