# Update log / 更新日志

## v1.2.3 (2026-10-23)

### English

A bug-fix release. Saved games and screenshots are safer, and several small annoyances are gone.

**Your work is safer.**
- Having PRTS open in two tabs no longer loses work. Before, closing an old forgotten tab could overwrite newer work, and the screenshots of those conferences were then deleted. Tabs now stay in sync.
- Undo right after an import no longer loses the conference's screenshot. **Update C#** keeps the previous screenshot, so undo brings it back.
- Loading a damaged or hand-edited JSON is refused and your current game is kept, instead of breaking the app on every reload.
- Loading a JSON or uploading a map no longer hangs when the browser storage is full.

**Security.** A crafted save file could no longer run code in the page, and the local server no longer crashes on a malformed address.

**Fixes.**
- Pressing Enter in a dialog (add player, rename conference, name map) now confirms it. In the import dialog it no longer closes the dialog and throws away the screenshot and names.
- One import no longer merges two different new players into one, and the Match / New labels update as you edit names.
- Switching conference, view or undoing in the middle of a drag no longer applies the drag to the wrong conference.
- Changing, uploading or deleting a map can now be undone. Deleting a custom map goes back to the default map.
- Clicking an unplaced player's token during playback no longer causes an error. Playback stops when you load a game, start a new one or delete a conference.
- Shift-click with the path tool no longer snaps a token back.
- The Conference tab shows renamed players right away, and renamed conferences update in the roster.
- Deleting a conference no longer gives the next one a duplicate label.
- "Zoom out" never zooms in on very large maps.
- Name reading recovers after a slow start instead of staying broken.

### 中文

本次为修复版本：保存的对局和截图更安全，并修正了若干小问题。

**更安全地保存。**
- 同时在两个标签页打开 PRTS 不会再丢失进度。以前关闭一个被遗忘的旧标签页可能覆盖较新的进度，相关会议的截图也会被删除。现在各标签页会保持同步。
- 导入后立即撤销不会再丢失该会议的截图。**更新 C#** 会保留之前的截图，撤销即可恢复。
- 载入损坏或手动修改过的 JSON 时会被拒绝并保留当前对局，不会再导致每次刷新都出错。
- 浏览器存储已满时，载入 JSON 或上传地图不会再卡住。

**安全。** 精心构造的存档文件无法再在页面中执行代码；本地服务器遇到异常地址也不会再崩溃。

**修复。**
- 在对话框（添加玩家、重命名会议、命名地图）中按回车现在会确认。在导入对话框中按回车不会再关闭对话框并丢弃截图和名字。
- 一次导入不会再把两个不同的新玩家合并成一个，编辑名字时“匹配 / 新建”标签会随之更新。
- 拖动过程中切换会议、视图或撤销，不会再把拖动应用到错误的会议上。
- 更换、上传或删除地图现在可以撤销。删除自定义地图后会回到默认地图。
- 回放时点击未放置玩家的棋子不会再出错。载入对局、新建对局或删除会议时会停止回放。
- 使用路线工具按住 Shift 单击不会再让棋子跳回。
- 会议页会立即显示改名后的玩家，会议改名后名单也会同步更新。
- 删除会议后，下一个会议不会再出现重复的编号。
- 在很大的地图上，“缩小”不会再变成放大。
- 名字识别启动较慢时会自动恢复，不会一直失败。

## v1.2.1 (2026-10-22)

### English

**New Basement map.** "Basement Map" is replaced by **Basement**, a cleaner, sharper map from the 鹅鸭杀 BWIKI. It is now the default map for a new game. Room names on the image are in Chinese.
- Games saved on the old Basement Map open on the new one. Positions, paths, drawings, pins and notes are moved to match it.

**New: map points.** On Basement, the **Map points** panel at the bottom right of the board shows the map's fixed spots, taken from the BWIKI interactive map:
- goose tasks and sabotages (shown by default)
- torches, spawns, food, hiding spots and peek points
- drumstick disposal, the portal and the tribute spot

Click a row to show or hide that group. Tick **Names** to write each point's name on the map. With the select tool, hover a point to see its name, room and how fast the task is. The points are included when you export a PNG.

**New map: Goose Chapel (Chinese).** The Goose Chapel map from the BWIKI, with Chinese room names. It has no points yet.

### 中文

**新地下室地图。** “地下室地图”换成了来自鹅鸭杀 BWIKI 的 **地下室**，更清晰。新对局默认使用这张地图。图上的房间名为中文。
- 在旧“地下室地图”上保存的对局会自动换到新地图，位置、路线、画笔、标记和文字都会对齐到新图上。

**新增：地图点位。** 在地下室地图上，画板右下角的 **地图点位** 面板会显示地图上的固定点位，数据来自 BWIKI 互动地图：
- 鹅任务和破坏（默认显示）
- 火把、出生点、食物、藏身处和透视点
- 鸡腿处理处、传送门和致敬点

点击某一行即可显示或隐藏该类点位。勾选 **名称** 会在地图上标出每个点位的名称。使用移动工具时，把鼠标停在点位上可以看到名称、所在房间和任务快慢。导出 PNG 时会包含这些点位。

**新地图：鹅教堂（中文）。** 来自 BWIKI 的鹅教堂地图，房间名为中文。暂时没有点位。

## v1.2.0 (2026-10-21)

Based on suggestions from players. / 根据玩家的建议改进。

### English

**Votes are now a "votes received" record.** In the game you only see how many votes each player got, not who voted for whom. The Conference tab now lists everyone who was in the meeting with − / + buttons to count their votes, plus a Skip row, and shows how many of the possible votes you have recorded. Each conference keeps its own count. With **Votes** turned on, each token on the board shows its vote count.
- Games saved with an older version keep their vote totals; who voted for whom is no longer stored.

**New: relationship network.** Use the **Map / Network** switch at the top right of the board (or press **N**). Network view puts everyone on a ring and draws this conference's relations between them, so links stay readable even when players were bunched up on the map. Drag players to rearrange the ring; **Reset layout** puts them back. Each conference has its own layout.

**New relation: Killed.** Draw it with the Link tool (L), from the killer to the victim. It shows as a thick crimson arrow with a ✕ mark.

**Event pins have their own form.** Body pins work as before (victim and a note). Event pins now record:
- what happened
- when: early / mid / late in the round, or a 30-second span (0:00–0:30 … 5:00+)
- which players were involved, shown as small avatars under the pin
- details

The Conference tab lists all events as a timeline, in time order. Click one to jump to it on the map.

**Quick status in the player list.** Each player in the list has alive / dead / ejected buttons. They apply to the conference you are viewing: marking someone dead in C3 means they died in C3.

### 中文

**投票改为得票记录。** 游戏里只能看到每人得了几票，看不到谁投了谁。现在 **会议** 标签页会列出参加本场会议的所有人，用 − / + 按钮记录每人的得票，还有一行“弃票”，并显示已记录的票数。每场会议分别记录。打开 **得票** 开关后，画板上每个头像会显示得票数。
- 旧版本保存的对局会保留每人的得票总数；谁投了谁不再保存。

**新增：关系网。** 用画板右上角的 **地图 / 关系网** 切换（或按 **N**）。关系网把所有人围成一圈，并画出本场会议的关系，即使玩家在地图上挤在一起，连线也看得清。可以拖动玩家调整位置，点 **重置布局** 恢复。每场会议的布局分别保存。

**新增关系：击杀。** 用关联工具（L）从凶手拖到死者。显示为粗的深红色箭头，中间带 ✕ 标记。

**事件标记有了自己的表单。** 尸体标记和以前一样（死者和备注）。事件标记现在可以记录：
- 发生了什么
- 时间：本轮的前期 / 中期 / 后期，或 30 秒区间（0:00–0:30 … 5:00+）
- 相关玩家，会以小头像显示在标记下方
- 详情

**会议** 标签页会把所有事件按时间排成时间轴。点击某一条即可跳到地图上的位置。

**玩家列表里快速设置状态。** 列表中每个玩家都有 存活 / 死亡 / 被投出 按钮。按钮作用于当前查看的会议：在 C3 把某人设为死亡，表示他在 C3 死亡。

## v1.1.0 (2026-10-21)

### English

**New name: PRTS.** The app was called GGD Thinking Space. It now shows PRTS in the header and the browser tab.

**New look.** The whole interface was redesigned in the style of the *Arknights* in-game menus:
- dark graphite panels with sharp, cut corners instead of rounded ones
- slanted C1 / C2 / C3 conference tabs, with the current one highlighted in yellow
- a tactical grid behind the map, and corner brackets on the board and the toolbars
- diamond markers for player reads (Goose-lean, Sus, Duck…)
- a new squared interface font, bundled with the app so it still works offline
- selected items (the current tool, language and status) show as a white highlight
- the panels slide in once when the page opens; this is skipped if your system has reduced motion turned on

**Other changes**
- Exported files are now named `prts-board-….png` and `prts-game-….json`.

**Your data carries over.** Games, custom maps and screenshots from 1.0.x are kept. Open the app at the same address (`http://localhost:7777`) in the same browser and they will be there. Saved `.json` games from 1.0.x load as before.

### 中文

**新名字：PRTS。** 本工具原名“鹅鸭杀推理空间”（GGD Thinking Space），现在标题栏和浏览器标签页显示为 PRTS。

**全新界面。** 整个界面按《明日方舟》游戏内菜单的风格重新设计：
- 深灰色面板，切角代替圆角
- 斜切的 C1 / C2 / C3 会议标签，当前会议以黄色标出
- 地图背后的战术网格，画板和工具栏四角的角标
- 玩家判断（偏鹅、可疑、鸭……）改为菱形标记
- 新的方正界面字体，已随程序打包，离线也能显示
- 选中项（当前工具、语言、状态）以白色高亮显示
- 打开页面时面板会滑入一次；如果系统开启了“减少动态效果”，则不播放

**其他改动**
- 导出的文件改名为 `prts-board-….png` 和 `prts-game-….json`。

**旧数据会保留。** 1.0.x 版本的对局、自定义地图和截图都会保留。只要用同一个浏览器打开同一个地址（`http://localhost:7777`）就能看到。1.0.x 保存的 `.json` 对局也可以照常读取。

## v1.0.1 (2026-10-21)

### English

- Fixed: dragging a player from the list, or dragging a player's icon, could show the "Drop screenshot to import" overlay by mistake.
- Fixed: that overlay could stay on screen after you dropped something onto the board.

### 中文

- 修复：从名单拖动玩家，或拖动玩家头像时，可能会误显示“松开即可导入截图”的提示层。
- 修复：把东西拖放到画板上之后，该提示层可能不消失。

## v1.0.0 (2026-10-21)

### English

First release.

### 中文

首个版本。
