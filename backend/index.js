const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http').createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server: http });
const PORT = process.env.PORT || 3001;

// 配置CORS
app.use(cors({
  origin: true, // Allow dynamic origin for development
  credentials: true
}));

// 解析JSON请求体
app.use(express.json());

// AI图像识别API
app.post('/api/recognize', async (req, res) => {
  try {
    const { imageData, roomId } = req.body;

    if (!imageData || !roomId) {
      return res.status(400).json({ error: '缺少图像数据或房间ID' });
    }

    // 调用OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请识别这幅画描绘的是什么物体，只需要返回一个简短的猜测结果，不要解释或添加额外内容。' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      max_tokens: 30
    });

    const guess = response.choices[0]?.message?.content || '无法识别图像';

    // 获取房间并广播AI猜测结果
    const room = rooms.get(roomId);
    if (room) {
      broadcastToRoom(roomId, JSON.stringify({
        type: 'ai_guess',
        guess: guess,
        timestamp: new Date().toISOString()
      }));
    }

    res.json({ success: true, guess: guess });
  } catch (error) {
    console.error('图像识别错误:', error);
    res.status(500).json({ error: '图像识别失败: ' + (error.message || '未知错误') });
  }
});

// 房间数据存储结构: { players: [], connections: Map, roundTimer: null }
  // 房间数据存储 (实际项目中应使用数据库)
const rooms = new Map();
const openai = require('./config/openai');

// 单词库
const wordBank = [
  '苹果', '香蕉', '汽车', '飞机', '大象', '篮球', '电脑', '雨伞', '书本', '鞋子',
  '火车', '自行车', '手机', '手表', '帽子', '眼镜', '吉他', '蛋糕', '钥匙', '房子'
];

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  // 解析URL参数
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const roomId = params.get('roomId');
    const playerName = params.get('playerName');
    let currentRoomId = roomId;
    let currentPlayerName = playerName;

    // 加入房间
    if (roomId && playerName) {
      joinRoom(roomId, playerName, ws);
    }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { type, roomId, playerName, payload } = data;

      // 处理加入房间事件
      if (type === 'join_room') {
        currentRoomId = roomId;
        currentPlayerName = playerName;
        const room = rooms.get(roomId);

        if (room) {
          // 将WebSocket连接添加到房间
          if (!room.connections) room.connections = new Set();
          room.connections.add(ws);

          // 广播新玩家加入消息
          broadcastToRoom(roomId, {
            type: 'player_joined',
            playerName,
            players: room.players
          });
        }
      }

      // 处理绘画事件
      // 处理回合开始事件
      if (type === 'start_round' && currentRoomId) {
        // 开始新回合
        if (currentRoomId && currentPlayerName) {
          const room = rooms.get(currentRoomId);
          if (room) {
            // 随机选择一个玩家作为绘画者
            const drawerIndex = Math.floor(Math.random() * room.players.length);
            const drawer = room.players[drawerIndex];
            // 随机选择一个单词
            const word = wordBank[Math.floor(Math.random() * wordBank.length)];
            // 清除现有计时器
              if (room.roundTimer) {
                clearTimeout(room.roundTimer);
              }

              // 设置新计时器 (60秒后结束回合)
              const roundTimer = setTimeout(() => {
                // 增加回合计数
                room.roundsPlayed += 1;

                // 检查是否达到最大回合数
                const gameOver = room.roundsPlayed >= room.maxRounds;

                // 广播回合结束消息
                broadcastToRoom(currentRoomId, JSON.stringify({
                  type: 'round_ended',
                  reason: 'time_out',
                  roundsPlayed: room.roundsPlayed,
                  maxRounds: room.maxRounds,
                  gameOver: gameOver,
                  timestamp: new Date().toISOString()
                }));

                // 如果游戏结束，不需要设置新计时器
                if (gameOver) {
                  room.roundTimer = null;
                  // 可以在这里添加游戏结束的额外逻辑，如计算胜利者等
                } else {
                  // 自动开始下一轮
                  setTimeout(() => {
                    startNextRound(currentRoomId);
                  }, 5000); // 5秒后开始下一轮
                }
              }, 60000);

              // 存储计时器ID
              room.roundTimer = roundTimer;

              // 广播回合开始消息
              broadcastToRoom(currentRoomId, JSON.stringify({
                type: 'round_started',
                drawer: drawer,
                word: word,
                timestamp: new Date().toISOString()
              }));
          }
        }
      }

      // 处理绘画事件
      if (type === 'draw_action' && currentRoomId) {
        // 广播绘画动作到房间内其他玩家
        broadcastToRoom(currentRoomId, {
          type: 'draw_action',
          playerName: currentPlayerName,
          action: payload
        }, ws);
      }

      // 处理聊天消息
      if (type === 'chat_message' && currentRoomId) {
        broadcastToRoom(currentRoomId, {
          type: 'chat_message',
          playerName: currentPlayerName,
          message: payload
        });
      }

      // 处理回合开始事件
      if (type === 'start_round' && currentRoomId) {
        broadcastToRoom(currentRoomId, {
          type: 'round_started',
          word: payload.word,
          timeLeft: payload.timeLeft
        });
      }

    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  // 连接关闭时清理
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room && room.connections) {
        room.connections.delete(ws);
        // 如果房间为空，删除房间
        if (room.connections.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          // 广播玩家离开消息
          broadcastToRoom(currentRoomId, {
            type: 'player_left',
            playerName: currentPlayerName,
            players: room.players.filter(p => p !== currentPlayerName)
          });
          // 更新房间玩家列表
          room.players = room.players.filter(p => p !== currentPlayerName);
          rooms.set(currentRoomId, room);
        }
      }
    }
  });
});

// 广播消息到房间内所有连接
// 开始下一轮
function startNextRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.players.length === 0) return;

  // 随机选择一个玩家作为绘画者
  const drawerIndex = Math.floor(Math.random() * room.players.length);
  const drawer = room.players[drawerIndex];
  // 随机选择一个单词
  const word = wordBank[Math.floor(Math.random() * wordBank.length)];

  // 清除现有计时器
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
  }

  // 设置新计时器 (60秒后结束回合)
  const roundTimer = setTimeout(() => {
    // 增加回合计数
    room.roundsPlayed += 1;

    // 检查是否达到最大回合数
    const gameOver = room.roundsPlayed >= room.maxRounds;

    // 广播回合结束消息
    broadcastToRoom(roomId, JSON.stringify({
      type: 'round_ended',
      reason: 'time_out',
      roundsPlayed: room.roundsPlayed,
      maxRounds: room.maxRounds,
      gameOver: gameOver,
      timestamp: new Date().toISOString()
    }));

    if (gameOver) {
      room.roundTimer = null;
    } else {
      setTimeout(() => {
        startNextRound(roomId);
      }, 5000);
    }
  }, 60000);

  // 存储计时器ID
  room.roundTimer = roundTimer;

  // 广播回合开始消息
  broadcastToRoom(roomId, JSON.stringify({
    type: 'round_started',
    drawer: drawer,
    word: word,
    timestamp: new Date().toISOString()
  }));
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room || !room.connections) return;

  const messageStr = JSON.stringify(message);
  room.connections.forEach((connection) => {
    if (connection !== excludeWs && connection.readyState === WebSocket.OPEN) {
      connection.send(messageStr);
    }
  });
}

// 生成唯一房间ID
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// 基础路由测试
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// 房间管理API
app.post('/api/rooms', (req, res) => {
  const { playerName } = req.body;
  if (!playerName) {
    return res.status(400).json({ error: '玩家名称不能为空' });
  }

  const roomId = generateRoomId();
  rooms.set(roomId, {
    id: roomId,
    players: [playerName],
    createdAt: new Date(),
    roundsPlayed: 0,
    maxRounds: 5,
    roundTimer: null,
    connections: new Map()
  });

  res.json({ roomId, message: '房间创建成功' });
});

app.post('/api/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { playerName } = req.body;

  if (!playerName) {
    return res.status(400).json({ error: '玩家名称不能为空' });
  }

  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }

  if (room.players.includes(playerName)) {
    return res.status(400).json({ error: '该玩家名称已在房间内' });
  }

  room.players.push(playerName);
  rooms.set(roomId, room);

  res.json({ message: '加入房间成功', roomId, players: room.players });
});

app.get('/api/rooms/:roomId/players', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }

  res.json({ players: room.players });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});