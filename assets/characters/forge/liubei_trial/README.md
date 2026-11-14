# 劉備 Forge 試做版（第10項）

圖片來源是 Codex 內建 image_gen：先生成低飽和、無金邊花紋的正面定稿，再以該定稿及主角／步行模板生成站立三視圖與三方向步行關鍵姿勢。沒有使用 API 或影片生成，也沒有退回程式繪製角色。

實際執行 Agent Sprite Forge 的 finish_frames.py pixel，以定稿24色色盤統一各方向、binary alpha、無 dithering，contrast=1、saturation=1、不加輪廓。所有 finish.json 的 scale 都是1.0，沒有縮小來源角色；只分格、去洋紅空白並排入指定畫布。步行每格512×512、腳底錨點(256,440)，站立1024×1024、錨點(512,1000)，最後填回純洋紅背景。

master.png 是定稿；sources/ 保留實際 image_gen 原始輸出；qa/ 保留 Forge 報告及檢視圖；provenance.json 記錄來源及工具版本。舊劉備圖片及 game.js 均未修改。

Forge 提示：pixel-reduction，value=1.0，threshold=4.0，出現在 qa/{master,stand,front,side,back}/finish.json。工具預期縮小4倍以上；為遵守佇列不縮圖規則，保留原始像素尺寸，以24色、硬邊及去零星噪點完成 Pixel 處理。這不是所有數值QA均通過的宣稱。

環境沒有影片生成路徑，使用 image_gen 關鍵姿勢與姿勢模板。數值完成檢查不證明步態的生理正確性或與主角完全一致，這套是供遊戲內比較的試做版。
