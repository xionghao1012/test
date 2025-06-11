import { useState, useRef, useEffect } from 'react';
import api, { createRoom, joinRoom } from './services/api';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [score, setScore] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [currentWord, setCurrentWord] = useState('');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<string[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isDrawingTurn, setIsDrawingTurn] = useState(false);
  const [aiGuess, setAiGuess] = useState('');

  // WebSocket连接函数
  const connectWebSocket = () => {
    if (socket) socket.close();
    const newSocket = new WebSocket(`ws://localhost:3001?roomId=${roomId}&playerName=${playerName}`);
    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log('WebSocket连接已建立');
    };

    newSocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleSocketMessage(message);
    };

    newSocket.onclose = () => {
      console.log('WebSocket连接已关闭');
      // 自动重连逻辑
      setTimeout(connectWebSocket, 3000);
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
  };

  // 处理WebSocket消息
  const handleSocketMessage = (message: any) => {
    switch (message.type) {
      case 'player_joined':
        setPlayers(message.players);
        break;
      case 'player_left':
        setPlayers(message.players);
        break;
      case 'draw_action':
        // 接收其他玩家的绘图动作
        if (message.playerName !== playerName) {
          drawFromData(message.data);
        }
        break;
      case 'ai_guess':
        setAiGuess(message.guess);
        // 检查AI猜测是否与目标单词匹配
        if (message.guess.toLowerCase().includes(currentWord.toLowerCase())) {
          setScore(prev => prev + 100);
          alert(`AI猜对了! +100分\nAI猜测: ${message.guess}\n正确答案: ${currentWord}`);
          endRound();
        }
        break;
      case 'round_started':
        setRoundActive(true);
        setCurrentWord(message.word);
        setTimeLeft(60);
        setIsDrawingTurn(message.drawer === playerName);
        break;
      case 'round_ended':
        setRoundActive(false);
        setCurrentWord('');
        setRoundsPlayed(message.roundsPlayed);
        setMaxRounds(message.maxRounds);
        if (message.gameOver) {
          setGameOver(true);
          alert('游戏结束! 共进行了 ' + message.roundsPlayed + ' 回合');
        }
        break;
      default:
        console.log('未知消息类型:', message.type);
    }
  };

  // Canvas initialization and drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set default styles
    ctx.strokeStyle = isEraser ? '#ffffff' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Drawing functions
    const startDrawing = (e: MouseEvent) => {
      if (!isDrawingTurn || !roundActive || !ctx) return;
      setIsDrawing(true);
      ctx.beginPath();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.moveTo(x, y);
      // 发送绘图开始动作
      if (socket) {
        socket.send(JSON.stringify({
          type: 'draw_action',
          roomId: roomId,
          playerName: playerName,
          data: {
            type: 'start',
            x, y,
            color: isEraser ? '#ffffff' : brushColor,
            size: brushSize
          }
        }));
      }
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing || !isDrawingTurn || !roundActive || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
      // 发送绘图动作
      if (socket) {
        socket.send(JSON.stringify({
          type: 'draw_action',
          roomId: roomId,
          playerName: playerName,
          data: {
            type: 'draw',
            x, y,
            lastX: ctx.lineTo.lastX || x,
            lastY: ctx.lineTo.lastY || y,
            color: isEraser ? '#ffffff' : brushColor,
            size: brushSize
          }
        }));
      }
    };

    const stopDrawing = () => {
      if (!ctx) return;
      setIsDrawing(false);
      ctx.closePath();
    };

    // Event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
    };
  }, [isDrawing, brushColor, brushSize]);

  // Clear canvas function
  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'drawing-' + new Date().toISOString().slice(0,10) + '.png';
    link.href = dataURL;
    link.click();
  };

  // AI猜图功能
  // 重新开始游戏
  const handleRestartGame = () => {
    setGameOver(false);
    setScore(0);
    setRoundsPlayed(0);
    clearCanvas();
    if (socket) {
      socket.send(JSON.stringify({
        type: 'start_round',
        roomId: roomId
      }));
    }
  };

  const handleAIGuess = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId) return;

    try {
      // 获取Canvas图像数据
      const imageData = canvas.toDataURL('image/png');
      setAiGuess('AI正在识别...');

      // 调用后端AI识别API
      const response = await api.post('/recognize', {
        imageData: imageData,
        roomId: roomId
      });

      setAiGuess(response.data.guess);
    } catch (error) {
      console.error('AI识别失败:', error);
      setAiGuess('识别失败，请重试');
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // 房间处理函数
  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('请输入昵称');
      return;
    }
    try {
      const data = await createRoom(playerName);
      setRoomId(data.roomId);
      setIsInRoom(true);
      setPlayers([playerName]);
    } catch (error) {
      alert('创建房间失败，请重试');
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomId.trim()) {
      alert('请输入昵称和房间ID');
      return;
    }
    try {
      const data = await joinRoom(roomId, playerName);
      setIsInRoom(true);
      setPlayers(data.players);
      // 连接WebSocket
      connectWebSocket();
    } catch (error) {
      alert('加入房间失败，请检查房间ID是否正确');
    }
  };
    }
  };

  // 单词库
  const wordBank = [
    '苹果', '香蕉', '汽车', '飞机', '大象', '篮球', '电脑', '雨伞', '书本', '鞋子'
  ];

  // 开始新回合
  const startNewRound = () => {
    if (socket) {
      socket.send(JSON.stringify({
        type: 'start_round',
        roomId: roomId
      }));
    }
  };

  // 更新得分
  const incrementScore = (points: number) => {
    setScore(prevScore => prevScore + points);
  };

  // 结束回合
  const endRound = () => {
    setRoundActive(false);
    setRoundsPlayed(prev => prev + 1);
    // 回合结束时给予基础分
    incrementScore(10);
  };

  // 计时器逻辑
  useEffect(() => {
    if (roundActive && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && roundActive) {
      endRound();
    }
  }, [timeLeft, roundActive]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AI 你画我猜</h1>
        {isInRoom ? (
          <div className="game-info">
          {gameOver && (
            <div className="game-over">
              <h2>游戏结束!</h2>
              <p>总回合: {roundsPlayed}/{maxRounds}</p>
              <button className="btn restart-btn" onClick={handleRestartGame}>再来一局</button>
            </div>
          )}
            <div>房间 ID: {roomId}</div>
            <div className="score">得分: {score}</div>
            <div className="timer">时间: {timeLeft}s</div>
            {roundActive && (
              <div className="word-hint">
                <span>当前词汇: </span>
                <span className="hint-word">{currentWord}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="room-controls">
            <input
              type="text"
              placeholder="输入昵称"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="name-input"
            />
            <div className="room-buttons">
              <button className="btn create-room-btn" onClick={handleCreateRoom}>创建房间</button>
              <div className="join-room">
                <input
                  type="text"
                  placeholder="房间 ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="room-input"
                />
                <button className="btn join-room-btn" onClick={handleJoinRoom}>加入房间</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="game-area">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            className="drawing-canvas"
            width={800}
            height={600}
          />
        </div>

        <div className="controls-panel">
          <div className="color-controls">
            <label>画笔颜色:</label>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
            />
          </div>

          <div className="brush-controls">
            <label>画笔大小: {brushSize}px</label>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </div>

          <div className="eraser-control">
            <label>
              <input
                type="checkbox"
                checked={isEraser}
                onChange={(e) => setIsEraser(e.target.checked)}
              />
              使用橡皮擦
            </label>
          </div>

          <div className="action-buttons">
              {!roundActive ? (
                <button className="btn start-round-btn" onClick={startNewRound} disabled={!isDrawingTurn}>开始新回合</button>
              ) : (
                <>                
                  <button className="btn clear-btn" onClick={clearCanvas}>清空画布</button>
                  <button className="btn save-btn" onClick={saveCanvas}>保存绘图</button>
                  <button className="btn guess-btn" onClick={handleAIGuess}>AI 猜图</button>
                </>
              )}
            </div>

          <div className="ai-guess">
            <h3>AI 猜测:</h3>
            <p className="guess-result">{aiGuess || '等待绘画...'}</p>
          </div>

          {isInRoom && (
            <div className="room-players">
              <h3>房间玩家 ({players.length}):</h3>
              <ul className="players-list">
                {players.map((player, index) => (
                  <li key={index} className="player-item">{player}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App
