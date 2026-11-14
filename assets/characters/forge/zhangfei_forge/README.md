# Forge 人物版本

來源為 Codex image_gen，先定稿再生成三方向站立與模板步行姿勢；沒有使用 API、影片生成或程式畫角色。依用戶「太簡了」的修正，保留甲片、衣褶及武器辨識細節，同時維持低飽和。

實際使用 Agent Sprite Forge finish_frames.py pixel：定稿32色共用色盤、contrast=1、saturation=1、outline=none、scale=1.0、不縮圖。只分格、移除洋紅空白、固定腳底並排版；站立1024×1024，步行2048×512（四格512）。舊人物圖與game.js未修改。

Forge警示 pixel-reduction：value=1.0、threshold=4.0，qa/{master,stand,front,side,back}/finish.json。工具原先偏好縮小4倍以上；為遵守不縮小規則，保留原始像素尺寸。其他警示若有，完整列於provenance.json，不宣稱所有QA通過。數值檢查不證明步態解剖正確。

master.png為定稿；sources/為五張實際生成原圖；qa/包含完成工具原始報告及檢視圖。
